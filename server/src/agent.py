import logging
import json
import asyncio
import time
from dataclasses import dataclass
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
    VOCABULARY = "vocabulary"
    PHRASES = "phrases"
    GRAMMAR = "grammar"
    PRACTICE = "practice"
    CONCLUSION = "conclusion"


@dataclass
class StudentProgress:
    correct_pronunciations: int = 0
    attempted_pronunciations: int = 0
    vocabulary_learned: Optional[List[str]] = None
    phrases_practiced: Optional[List[str]] = None
    engagement_score: int = 0  # 1-10

    def __post_init__(self):
        if self.vocabulary_learned is None:
            self.vocabulary_learned = []
        if self.phrases_practiced is None:
            self.phrases_practiced = []


class LanguageTeacher(Agent):
    def __init__(self, lesson_data: Dict[str, Any]) -> None:
        self.lesson = lesson_data
        self.start_time: Optional[float] = None
        self.current_stage = LessonStage.INTRO
        self.current_vocab_index = 0
        self.current_phrase_index = 0
        self.current_grammar_index = 0
        self.student_progress = StudentProgress()
        self.pronunciation_attempts = {}  # Track attempts per word/phrase
        self.lesson_completed = False

        # Extract language from lesson or default to German
        self.target_language = self.lesson.get('language', 'German')

        instructions = f"""You are an AI language teacher conducting a 10-minute {self.target_language} lesson.

LESSON DETAILS:
Title: {self.lesson['title']}
Description: {self.lesson['description']}

YOUR TEACHING APPROACH:
1. Be encouraging, patient, and supportive
2. Speak clearly and at an appropriate pace for beginners
3. Use simple English explanations mixed with {self.target_language}
4. Always wait for student responses before moving on
5. Correct pronunciation gently and positively
6. Keep segments short and interactive

CURRENT LESSON STAGE: Introduction
PROGRESS: Starting lesson

Remember: This is a live conversation. Keep responses natural and conversational, not scripted."""

        super().__init__(instructions=instructions)

    @function_tool
    async def start_lesson_timer(self, context: RunContext):
        """Start the 10-minute lesson timer."""
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

        if remaining <= 0:
            await self.conclude_lesson(context)
            return "Time is up! Let's wrap up the lesson."

        minutes = int(remaining // 60)
        seconds = int(remaining % 60)
        return f"{minutes} minutes and {seconds} seconds remaining."

    @function_tool
    async def teach_vocabulary_word(self, context: RunContext, word_index: Optional[int] = None):
        """Teach the next vocabulary word or a specific word by index."""
        if word_index is None:
            word_index = self.current_vocab_index

        if word_index >= len(self.lesson['vocabulary']):
            return "All vocabulary words have been covered. Moving to phrases."

        word = self.lesson['vocabulary'][word_index]
        self.current_stage = LessonStage.VOCABULARY
        self.current_vocab_index = word_index

        return f"Let's learn the word: {word}. Listen carefully and then repeat after me: {word}"

    @function_tool
    async def check_pronunciation(self, context: RunContext, target_word: str, student_attempt: str):
        """Check if the student's pronunciation attempt matches the target word."""
        # Simple pronunciation checking - in production, you'd use more sophisticated methods
        target_clean = target_word.lower().strip()
        attempt_clean = student_attempt.lower().strip()

        # Initialize attempt counter
        if target_word not in self.pronunciation_attempts:
            self.pronunciation_attempts[target_word] = 0

        self.pronunciation_attempts[target_word] += 1
        self.student_progress.attempted_pronunciations += 1

        # Simple similarity check (in production, use phonetic similarity)
        similarity_threshold = 0.7
        if target_clean in attempt_clean or attempt_clean in target_clean:
            self.student_progress.correct_pronunciations += 1
            if self.student_progress.vocabulary_learned is not None:
                self.student_progress.vocabulary_learned.append(target_word)
            return f"Excellent! Your pronunciation of '{target_word}' is very good. Let's move on."
        else:
            # Give up to 3 attempts
            if self.pronunciation_attempts[target_word] < 3:
                return f"Good try! Let me say it again: {target_word}. Listen to the sounds and try once more."
            else:
                return f"That's okay, pronunciation takes practice. The word is {target_word}. Let's continue with the next word."

    @function_tool
    async def teach_phrase(self, context: RunContext, phrase_index: Optional[int] = None):
        """Teach the next phrase or a specific phrase by index."""
        if phrase_index is None:
            phrase_index = self.current_phrase_index

        if phrase_index >= len(self.lesson['phrases']):
            return "All phrases have been covered. Moving to grammar."

        phrase = self.lesson['phrases'][phrase_index]
        self.current_stage = LessonStage.PHRASES
        self.current_phrase_index = phrase_index

        return f"Now let's learn this phrase: {phrase}. This is very useful in conversations. Try repeating: {phrase}"

    @function_tool
    async def explain_grammar(self, context: RunContext, grammar_index: Optional[int] = None):
        """Explain a grammar rule from the lesson."""
        if grammar_index is None:
            grammar_index = self.current_grammar_index

        if grammar_index >= len(self.lesson['grammar']):
            return "All grammar concepts have been covered. Let's practice what we've learned."

        grammar_rule = self.lesson['grammar'][grammar_index]
        self.current_stage = LessonStage.GRAMMAR
        self.current_grammar_index = grammar_index

        return f"Let me explain this grammar concept: {grammar_rule}. This is important for building sentences correctly."

    @function_tool
    async def move_to_next_stage(self, context: RunContext):
        """Move to the next stage of the lesson."""
        if self.current_stage == LessonStage.INTRO:
            self.current_stage = LessonStage.VOCABULARY
            return "Great! Now let's start learning vocabulary words."
        elif self.current_stage == LessonStage.VOCABULARY:
            self.current_stage = LessonStage.PHRASES
            return "Excellent work on vocabulary! Now let's learn some useful phrases."
        elif self.current_stage == LessonStage.PHRASES:
            self.current_stage = LessonStage.GRAMMAR
            return "Good job with phrases! Now let's understand some grammar rules."
        elif self.current_stage == LessonStage.GRAMMAR:
            self.current_stage = LessonStage.PRACTICE
            return "Perfect! Now let's practice using everything together."
        else:
            return await self.conclude_lesson(context)

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

        # Get vocabulary learned count
        vocab_learned_count = len(
            self.student_progress.vocabulary_learned) if self.student_progress.vocabulary_learned else 0

        # Determine if student passed (basic criteria)
        passed = (pronunciation_accuracy >= 60 and
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

        if vocab_learned_count >= 5:
            feedback_parts.append("Great vocabulary retention")
        elif vocab_learned_count >= 3:
            feedback_parts.append("Good vocabulary learning")
        else:
            feedback_parts.append("More vocabulary practice needed")

        # Words that need review
        review_words = []
        vocab_learned_list = self.student_progress.vocabulary_learned or []
        for word in self.lesson['vocabulary'][:5]:  # Check first 5 vocab words
            if word not in vocab_learned_list:
                review_words.append(word)

        feedback_text = ". ".join(feedback_parts)
        if review_words:
            feedback_text += f". Please review: {', '.join(review_words)}"

        lesson_feedback = {
            "passed": passed,
            "feedback": feedback_text,
            "pronunciation_accuracy": round(pronunciation_accuracy, 1),
            "vocabulary_learned": vocab_learned_count,
            "engagement_score": self.student_progress.engagement_score,
            "words_to_review": review_words
        }

        logger.info(f"Lesson completed with feedback: {lesson_feedback}")

        return f"Lesson complete! Here's your feedback: {json.dumps(lesson_feedback, indent=2)}"

    @function_tool
    async def get_lesson_progress(self, context: RunContext):
        """Get current lesson progress and status."""
        progress_info = {
            "current_stage": self.current_stage.value,
            "vocabulary_progress": f"{self.current_vocab_index + 1}/{len(self.lesson['vocabulary'])}",
            "phrase_progress": f"{self.current_phrase_index + 1}/{len(self.lesson['phrases'])}",
            "grammar_progress": f"{self.current_grammar_index + 1}/{len(self.lesson['grammar'])}",
            "pronunciation_accuracy": f"{self.student_progress.correct_pronunciations}/{self.student_progress.attempted_pronunciations}",
            "words_learned": len(self.student_progress.vocabulary_learned) if self.student_progress.vocabulary_learned else 0
        }

        return f"Current progress: {json.dumps(progress_info, indent=2)}"


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    # Extract lesson data from room metadata or provide default
    lesson_data = ctx.room.metadata or json.dumps({
        "title": "Lesson 1: Greetings and Basic Introductions",
        "description": "Learn basic German greetings and how to introduce yourself, including asking about well-being.",
        "objectives": [
            "Greet someone in German using different greetings",
            "Introduce yourself by stating your name, origin, and profession",
            "Ask someone their name and how they are, and respond appropriately",
            "Understand the difference between formal and informal greetings and apply them correctly"
        ],
        "vocabulary": [
            "Hallo (Hello)", "Guten Tag (Good day)", "Guten Morgen (Good morning)",
            "Guten Abend (Good evening)", "Wie (How)", "Geht (Goes)", "Es (It)",
            "Ihnen (You - formal)", "Dir (You - informal)", "Mir (Me)", "Gut (Good)"
        ],
        "phrases": [
            "Hallo!", "Guten Tag!", "Guten Morgen!", "Guten Abend!",
            "Wie geht es Ihnen?", "Wie geht es dir?", "Mir geht es gut, danke.",
            "Und Ihnen?", "Und dir?", "Ich heiße...", "Mein Name ist..."
        ],
        "grammar": [
            "Formal vs. Informal 'you' (Sie vs. du)",
            "Subject pronouns (Ich, Sie, du)",
            "Verb 'heißen' (to be called/named) conjugation",
            "Basic question formation"
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
        agent=LanguageTeacher(lesson_data),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        room_output_options=RoomOutputOptions(transcription_enabled=True),
    )

    # Join the room when agent is ready
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
