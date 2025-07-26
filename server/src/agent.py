import logging
import json
import asyncio
import time
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    RunContext,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.agents.llm import function_tool
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("language_teacher")

load_dotenv(".env")


class LessonStage(Enum):
    INTRO = "intro"
    PHRASE_LEARNING = "phrase_learning"
    PRACTICE_DIALOGUE = "practice_dialogue"
    CONCLUSION = "conclusion"


@dataclass
class PhraseData:
    phrase: str
    meaning: str
    vocabulary: List[str]
    grammar_points: List[str]


@dataclass
class StudentProgress:
    correct_pronunciations: int = 0
    attempted_pronunciations: int = 0
    phrases_learned: List[str] = field(default_factory=list)
    vocabulary_learned: List[str] = field(default_factory=list)
    grammar_learned: List[str] = field(default_factory=list)
    engagement_score: int = 0  # 1-10


class LanguageTeacher(Agent):
    def __init__(self, lesson_data: Dict[str, Any]) -> None:
        self.lesson = lesson_data
        self.start_time: Optional[float] = None
        self.current_stage = LessonStage.INTRO
        self.current_phrase_index = 0
        self.student_progress = StudentProgress()
        self.pronunciation_attempts = {}  # Track attempts per phrase
        self.lesson_completed = False
        self.lesson_started = False
        # Track whose turn it is in dialogue (0 = AI, 1 = student)
        self.dialogue_turn = 0
        self.dialogue_phrases_used = []  # Track which phrases have been used in dialogue

        # Extract language from lesson or default to German
        self.target_language = self.lesson.get('language', 'German')

        # Process lesson data to create phrase structures
        self.phrase_data = self._process_lesson_data()

        instructions = f"""You are an AI language teacher conducting a 10-minute {self.target_language} lesson.

LESSON DETAILS:
Title: {self.lesson['title']}
Description: {self.lesson['description']}

YOUR TEACHING APPROACH:
1. ALWAYS START the conversation by introducing yourself and the lesson
2. Teach through PHRASES, not individual words
3. For each phrase: EXPLAIN meaning, vocabulary, and grammar BEFORE asking student to repeat
4. Be encouraging, patient, and supportive
5. Speak clearly and at an appropriate pace for beginners
6. Use simple English explanations mixed with {self.target_language}
7. PROACTIVELY guide the student through each step
8. Correct pronunciation gently and positively
9. Track vocabulary and grammar learned through phrases
10. End with a dialogue practice using learned phrases

IMPORTANT: You must start the lesson immediately when the session begins. Don't wait for the student to speak first.

Begin with: "Hello! Welcome to your {self.target_language} lesson. I'm your AI language teacher, and today we'll be learning about {self.lesson['title']}. Let's start our 10-minute lesson!"

Then immediately begin teaching the first phrase with full explanation."""

        super().__init__(instructions=instructions)

    def _process_lesson_data(self) -> List[PhraseData]:
        """Process lesson data to create structured phrase data with vocabulary and grammar"""
        phrase_data = []

        # Create enhanced phrase data from lesson
        phrases = self.lesson.get('phrases', [])
        vocabulary = self.lesson.get('vocabulary', [])
        grammar = self.lesson.get('grammar', [])
        phrase_explanations = self.lesson.get('phrase_explanations', {})

        for i, phrase in enumerate(phrases):
            # Get explanation or create a default one
            meaning = phrase_explanations.get(
                phrase, f"A common {self.target_language} phrase")

            # Extract vocabulary words that appear in this phrase
            phrase_vocab = [
                word for word in vocabulary if word.lower() in phrase.lower()]

            # Assign grammar points (distribute evenly across phrases)
            phrase_grammar = []
            if i < len(grammar):
                phrase_grammar.append(grammar[i])

            phrase_data.append(PhraseData(
                phrase=phrase,
                meaning=meaning,
                vocabulary=phrase_vocab,
                grammar_points=phrase_grammar
            ))

        return phrase_data

    @function_tool
    async def begin_lesson(self, ctx: RunContext):
        """Start the lesson with an introduction and first phrase"""
        if self.lesson_started:
            return "Lesson already started."

        self.lesson_started = True

        intro_message = f"""Hello! Welcome to your {self.target_language} lesson. I'm your AI language teacher, and today we'll be learning about {self.lesson['title']}.

{self.lesson['description']}

We have 10 minutes together, so let's make the most of it! I'll teach you through useful phrases, explaining the vocabulary and grammar as we go.

Let's start with our first phrase. Are you ready?"""

        # Automatically move to first phrase after introduction
        await asyncio.sleep(2)
        await self.teach_phrase_with_explanation(ctx, 0)

        return intro_message

    @function_tool
    async def start_lesson_timer(self, context: RunContext):
        """Start the 10-minute lesson timer."""
        if self.start_time is None:
            self.start_time = time.time()
            logger.info("Lesson timer started")
        return "Lesson timer started. You have 10 minutes for this lesson."

    @function_tool
    async def check_time_remaining(self, context: RunContext):
        """Check how much time is left in the lesson."""
        if not self.start_time:
            return "Lesson hasn't started yet."

        elapsed = time.time() - self.start_time
        remaining = max(0.0, 600.0 - elapsed)  # 600 seconds = 10 minutes

        if remaining <= 120:  # 2 minutes left - move to dialogue
            if self.current_stage != LessonStage.PRACTICE_DIALOGUE:
                await self.start_dialogue_practice(context)
                return "We have 2 minutes left. Let's practice with a dialogue!"

        if remaining <= 0:
            await self.conclude_lesson(context)
            return "Time is up! Let's wrap up the lesson."

        minutes = int(remaining // 60)
        seconds = int(remaining % 60)
        return f"{minutes} minutes and {seconds} seconds remaining."

    @function_tool
    async def teach_phrase_with_explanation(self, context: RunContext, phrase_index: Optional[int] = None):
        """Teach a phrase with full explanation of meaning, vocabulary, and grammar."""
        if phrase_index is None:
            phrase_index = self.current_phrase_index

        if phrase_index >= len(self.phrase_data):
            # Move to dialogue practice when all phrases are taught
            await asyncio.sleep(1)
            await self.start_dialogue_practice(context)
            return "Excellent! You've learned all the phrases. Now let's practice using them in conversation!"

        phrase_info = self.phrase_data[phrase_index]
        self.current_stage = LessonStage.PHRASE_LEARNING
        self.current_phrase_index = phrase_index

        # Build comprehensive explanation
        explanation = f"""Great! Let's learn this important phrase: "{phrase_info.phrase}"

MEANING: {phrase_info.meaning}

VOCABULARY in this phrase:"""

        # Explain vocabulary words
        if phrase_info.vocabulary:
            for word in phrase_info.vocabulary:
                explanation += f"\n- '{word}' - a key word in {self.target_language}"
        else:
            explanation += f"\n- This phrase introduces you to common {self.target_language} sounds and structure"

        # Explain grammar points
        if phrase_info.grammar_points:
            explanation += f"\n\nGRAMMAR POINT: {phrase_info.grammar_points[0]}"

        explanation += f"""

Now listen carefully to how I pronounce it: {phrase_info.phrase}

Your turn - please repeat after me: {phrase_info.phrase}

Go ahead and say it out loud!"""

        return explanation

    @function_tool
    async def check_phrase_pronunciation(self, context: RunContext, target_phrase: str, student_attempt: str):
        """Check if the student's pronunciation attempt matches the target phrase."""
        # Find the current phrase data
        current_phrase_info = None
        for phrase_info in self.phrase_data:
            if phrase_info.phrase == target_phrase:
                current_phrase_info = phrase_info
                break

        if not current_phrase_info:
            return "I couldn't find that phrase in our lesson."

        # Initialize attempt counter
        if target_phrase not in self.pronunciation_attempts:
            self.pronunciation_attempts[target_phrase] = 0

        self.pronunciation_attempts[target_phrase] += 1
        self.student_progress.attempted_pronunciations += 1

        # Simple similarity check (in production, use phonetic similarity)
        target_clean = target_phrase.lower().strip()
        attempt_clean = student_attempt.lower().strip()

        if target_clean in attempt_clean or attempt_clean in target_clean or len(set(target_clean.split()) & set(attempt_clean.split())) >= len(target_clean.split()) // 2:
            self.student_progress.correct_pronunciations += 1

            # Track learned content
            self.student_progress.phrases_learned.append(target_phrase)
            self.student_progress.vocabulary_learned.extend(
                current_phrase_info.vocabulary)
            self.student_progress.grammar_learned.extend(
                current_phrase_info.grammar_points)

            # Remove duplicates
            self.student_progress.vocabulary_learned = list(
                set(self.student_progress.vocabulary_learned))
            self.student_progress.grammar_learned = list(
                set(self.student_progress.grammar_learned))

            response = f"Excellent! Your pronunciation of '{target_phrase}' is very good. You've learned this phrase and its vocabulary!"

            # Move to next phrase
            next_index = self.current_phrase_index + 1
            if next_index < len(self.phrase_data):
                self.current_phrase_index = next_index
                await asyncio.sleep(1)
                next_phrase_instruction = await self.teach_phrase_with_explanation(context, next_index)
                response += f"\n\n{next_phrase_instruction}"
            else:
                await asyncio.sleep(1)
                await self.start_dialogue_practice(context)
                response += "\n\nWonderful! You've learned all the phrases. Now let's practice using them in conversation!"

            return response
        else:
            # Give up to 3 attempts
            if self.pronunciation_attempts[target_phrase] < 3:
                return f"Good try! Let me say it again: {target_phrase}. Remember: {current_phrase_info.meaning}. Listen carefully and try once more: {target_phrase}"
            else:
                response = f"That's okay, pronunciation takes practice. The phrase is '{target_phrase}' meaning '{current_phrase_info.meaning}'. Let's continue with the next phrase."

                # Move to next phrase after 3 attempts
                next_index = self.current_phrase_index + 1
                if next_index < len(self.phrase_data):
                    self.current_phrase_index = next_index
                    await asyncio.sleep(1)
                    next_phrase_instruction = await self.teach_phrase_with_explanation(context, next_index)
                    response += f"\n\n{next_phrase_instruction}"
                else:
                    await asyncio.sleep(1)
                    await self.start_dialogue_practice(context)
                    response += "\n\nLet's move on to practice what we've learned in conversation!"

                return response

    @function_tool
    async def start_dialogue_practice(self, context: RunContext):
        """Start the dialogue practice phase."""
        self.current_stage = LessonStage.PRACTICE_DIALOGUE
        self.dialogue_turn = 0  # AI starts

        learned_phrases = self.student_progress.phrases_learned
        if not learned_phrases:
            # Use first 2 phrases as fallback
            learned_phrases = [
                phrase.phrase for phrase in self.phrase_data[:2]]

        instruction = f"""Perfect! Now let's practice using what you've learned in a real conversation.

I'll start our dialogue using the phrases we learned, then it will be your turn. Try to respond using the phrases you've learned.

Here we go - I'll begin:

{learned_phrases[0] if learned_phrases else "Hallo!"}

Now it's your turn! Respond using one of the phrases we learned."""

        self.dialogue_turn = 1  # Now it's student's turn
        self.dialogue_phrases_used.append(
            learned_phrases[0] if learned_phrases else "Hallo!")

        return instruction

    @function_tool
    async def continue_dialogue(self, context: RunContext, student_response: str):
        """Continue the dialogue practice, alternating turns."""
        learned_phrases = self.student_progress.phrases_learned
        if not learned_phrases:
            learned_phrases = [phrase.phrase for phrase in self.phrase_data]

        if self.dialogue_turn == 1:  # Student's turn just finished
            # Acknowledge student's response
            response = f"Great response! I heard you say: '{student_response}'"

            # AI's turn - use a phrase that hasn't been used yet
            unused_phrases = [
                p for p in learned_phrases if p not in self.dialogue_phrases_used]
            if unused_phrases:
                ai_phrase = unused_phrases[0]
                self.dialogue_phrases_used.append(ai_phrase)
                response += f"\n\nNow I'll respond: {ai_phrase}"
                response += f"\n\nYour turn again! Try using another phrase we learned."
                self.dialogue_turn = 1  # Keep it student's turn
            else:
                # All phrases used, conclude dialogue
                response += f"\n\nExcellent dialogue practice! You've used the phrases very well."
                await asyncio.sleep(1)
                await self.conclude_lesson(context)
                response += "\n\nLet's wrap up our lesson now."

        else:  # AI's turn
            # This shouldn't happen in normal flow, but handle it
            response = "Let me continue our conversation..."
            self.dialogue_turn = 1

        return response

    @function_tool
    async def assess_student_engagement(self, context: RunContext, engagement_level: int):
        """Record student engagement level (1-10)."""
        self.student_progress.engagement_score = max(
            1, min(10, engagement_level))
        return f"Student engagement recorded as {engagement_level}/10."

    @function_tool
    async def conclude_lesson(self, context: RunContext):
        """Conclude the lesson and provide feedback."""
        self.lesson_completed = True
        self.current_stage = LessonStage.CONCLUSION

        # Calculate performance metrics
        pronunciation_accuracy: float = 0.0
        if self.student_progress.attempted_pronunciations > 0:
            pronunciation_accuracy = (self.student_progress.correct_pronunciations /
                                      self.student_progress.attempted_pronunciations) * 100

        # Get learning counts
        phrases_learned_count = len(self.student_progress.phrases_learned)
        vocab_learned_count = len(self.student_progress.vocabulary_learned)
        grammar_learned_count = len(self.student_progress.grammar_learned)

        # Determine if student passed (enhanced criteria)
        passed = (pronunciation_accuracy >= 60 and
                  phrases_learned_count >= 2 and
                  vocab_learned_count >= 3 and
                  self.student_progress.engagement_score >= 5)

        # Generate feedback
        feedback_parts = []
        if pronunciation_accuracy >= 80:
            feedback_parts.append("Excellent pronunciation")
        elif pronunciation_accuracy >= 60:
            feedback_parts.append(
                "Good pronunciation with room for improvement")
        else:
            feedback_parts.append("Pronunciation needs more practice")

        if phrases_learned_count >= 4:
            feedback_parts.append("Outstanding phrase mastery")
        elif phrases_learned_count >= 2:
            feedback_parts.append("Good phrase learning")
        else:
            feedback_parts.append("More phrase practice needed")

        # Phrases that need review
        review_phrases = []
        total_phrases = [phrase.phrase for phrase in self.phrase_data]
        for phrase in total_phrases[:4]:  # Check first 4 phrases
            if phrase not in self.student_progress.phrases_learned:
                review_phrases.append(phrase)

        feedback_text = ". ".join(feedback_parts)
        if review_phrases:
            feedback_text += f". Please review these phrases: {', '.join(review_phrases)}"

        lesson_feedback = {
            "passed": passed,
            "feedback": feedback_text,
            "pronunciation_accuracy": round(pronunciation_accuracy, 1),
            "phrases_learned": phrases_learned_count,
            "vocabulary_learned": vocab_learned_count,
            "grammar_learned": grammar_learned_count,
            "engagement_score": self.student_progress.engagement_score,
            "phrases_to_review": review_phrases
        }

        logger.info(f"Lesson completed with feedback: {lesson_feedback}")

        conclusion_message = f"""Congratulations! You've completed your {self.target_language} lesson on {self.lesson['title']}.

Here's your performance summary:
- Pronunciation accuracy: {pronunciation_accuracy:.1f}%
- Phrases learned: {phrases_learned_count}
- Vocabulary words learned: {vocab_learned_count}
- Grammar concepts learned: {grammar_learned_count}
- Overall performance: {"Passed" if passed else "Needs improvement"}

{feedback_text}

Great job today! Keep practicing these phrases, and I'll see you in the next lesson. Auf Wiedersehen!"""

        return conclusion_message

    @function_tool
    async def get_lesson_progress(self, context: RunContext):
        """Get current lesson progress and status."""
        progress_info = {
            "current_stage": self.current_stage.value,
            "phrase_progress": f"{self.current_phrase_index + 1}/{len(self.phrase_data)}",
            "pronunciation_accuracy": f"{self.student_progress.correct_pronunciations}/{self.student_progress.attempted_pronunciations}",
            "phrases_learned": len(self.student_progress.phrases_learned),
            "vocabulary_learned": len(self.student_progress.vocabulary_learned),
            "grammar_learned": len(self.student_progress.grammar_learned),
            "dialogue_turn": "Student" if self.dialogue_turn == 1 else "AI"
        }

        return f"Current progress: {json.dumps(progress_info, indent=2)}"


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    # Extract lesson data from room metadata or provide default
    lesson_data = ctx.room.metadata or json.dumps({
        "title": "Lesson 1: Greetings and Basic Introductions",
        "description": "Learn basic German greetings and how to introduce yourself through practical phrases.",
        "objectives": [
            "Greet someone in German using different greetings",
            "Introduce yourself by stating your name, origin, and profession",
            "Ask someone their name and how they are, and respond appropriately",
            "Understand the difference between formal and informal greetings and apply them correctly"
        ],
        "vocabulary": [
            "Hallo", "Guten", "Tag", "Morgen", "Abend",
            "Wie", "geht", "es", "Ihnen", "dir", "mir", "gut",
            "ich", "heiße", "Name", "ist", "danke", "und"
        ],
        "phrases": [
            "Hallo! Wie geht es dir?",
            "Guten Tag! Wie geht es Ihnen?",
            "Mir geht es gut, danke.",
            "Ich heiße Maria. Wie heißen Sie?",
            "Mein Name ist Peter.",
            "Guten Morgen! Haben Sie einen schönen Tag!",
            "Auf Wiedersehen! Bis bald!"
        ],
        "phrase_explanations": {
            "Hallo! Wie geht es dir?": "Informal greeting asking 'Hello! How are you?'",
            "Guten Tag! Wie geht es Ihnen?": "Formal greeting asking 'Good day! How are you?'",
            "Mir geht es gut, danke.": "Response meaning 'I'm doing well, thank you.'",
            "Ich heiße Maria. Wie heißen Sie?": "Introducing yourself: 'My name is Maria. What is your name?'",
            "Mein Name ist Peter.": "Another way to introduce yourself: 'My name is Peter.'",
            "Guten Morgen! Haben Sie einen schönen Tag!": "Morning greeting: 'Good morning! Have a nice day!'",
            "Auf Wiedersehen! Bis bald!": "Farewell: 'Goodbye! See you soon!'"
        },
        "grammar": [
            "Formal vs. Informal 'you' (Sie vs. du) - Sie is formal, du is informal",
            "Verb 'heißen' (to be called/named) conjugation - ich heiße, Sie heißen",
            "Basic question formation with 'Wie' (how)",
            "Polite expressions and responses"
        ],
        "duration": 10
    })

    # Parse lesson data if it's a string
    if isinstance(lesson_data, str):
        lesson_data = json.loads(lesson_data)

    ctx.log_context_fields = {
        "room": ctx.room.name,
        "lesson": lesson_data.get('title', 'Unknown Lesson')
    }

    # Create the language teacher agent
    teacher_agent = LanguageTeacher(lesson_data)

    # Set up the AI teacher session
    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        stt=deepgram.STT(model="nova-3", language="multi"),
        tts=cartesia.TTS(voice="6f84f4b8-58a2-430c-8c79-688dad597532"),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
    )

    # Set up metrics collection
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    # Start the teaching session
    await session.start(
        agent=teacher_agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        room_output_options=RoomOutputOptions(transcription_enabled=True),
    )

    # Join the room when agent is ready
    await ctx.connect()

    # Give a moment for connection to stabilize, then start the lesson
    await asyncio.sleep(2)

    # Start the lesson automatically
    async def start_lesson():
        try:
            # Start the lesson timer
            teacher_agent.start_time = time.time()
            logger.info("Lesson timer started")

            # Begin the lesson with the introduction
            intro_message = f"""Hello! Welcome to your {teacher_agent.target_language} lesson. I'm your AI language teacher, and today we'll be learning about {teacher_agent.lesson['title']}.

{teacher_agent.lesson['description']}

We have 10 minutes together, so let's make the most of it! I'll teach you through useful phrases, explaining the vocabulary and grammar as we go.

Let's start with our first phrase. Are you ready?"""

            # Send the introduction message
            await session.say(intro_message)

            # Wait a moment, then start with the first phrase
            await asyncio.sleep(3)

            # Start with the first phrase with full explanation
            teacher_agent.lesson_started = True
            teacher_agent.current_stage = LessonStage.PHRASE_LEARNING

            if teacher_agent.phrase_data:
                phrase_info = teacher_agent.phrase_data[0]

                explanation = f"""Great! Let's learn this important phrase: "{phrase_info.phrase}"

MEANING: {phrase_info.meaning}

VOCABULARY in this phrase:"""

                # Explain vocabulary words
                if phrase_info.vocabulary:
                    for word in phrase_info.vocabulary:
                        explanation += f"\n- '{word}' - a key word in {teacher_agent.target_language}"
                else:
                    explanation += f"\n- This phrase introduces you to common {teacher_agent.target_language} sounds and structure"

                # Explain grammar points
                if phrase_info.grammar_points:
                    explanation += f"\n\nGRAMMAR POINT: {phrase_info.grammar_points[0]}"

                explanation += f"""

Now listen carefully to how I pronounce it: {phrase_info.phrase}

Your turn - please repeat after me: {phrase_info.phrase}

Go ahead and say it out loud!"""

                await session.say(explanation)

        except Exception as e:
            logger.error(f"Error starting lesson: {e}")

    # Start the lesson after a brief delay
    asyncio.create_task(start_lesson())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
