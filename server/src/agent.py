import logging
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
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
from livekit.agents.llm import function_tool, ChatContext, ChatMessage
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("language_agent")
load_dotenv(".env.local")


class LessonPhase(Enum):
    INTRODUCTION = "introduction"
    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    PRACTICE = "practice"
    ASSESSMENT = "assessment"
    FEEDBACK = "feedback"


@dataclass
class LessonProgress:
    current_phase: LessonPhase
    vocabulary_index: int
    grammar_index: int
    pronunciation_attempts: Dict[str, int]
    correct_pronunciations: Dict[str, bool]
    lesson_score: Dict[str, float]
    mistakes: List[str]
    started_at: float
    phase_start_time: float


@dataclass
class LessonData:
    lesson_id: str
    course_id: str
    title: str
    target_language: str
    language_code: str
    content: str
    objectives: List[str]
    vocabulary: List[str]
    grammar: List[str]
    native_language: str
    estimated_duration: int


class LanguageTeacher(Agent):
    def __init__(self, lesson_data: LessonData) -> None:
        self.lesson_data = lesson_data
        self.progress = LessonProgress(
            current_phase=LessonPhase.INTRODUCTION,
            vocabulary_index=0,
            grammar_index=0,
            pronunciation_attempts={},
            correct_pronunciations={},
            lesson_score={"vocabulary": 0.0, "grammar": 0.0,
                          "pronunciation": 0.0, "participation": 0.0},
            mistakes=[],
            started_at=0.0,
            phase_start_time=0.0
        )

        super().__init__(
            instructions=self._build_instructions(),
        )

    def _build_instructions(self) -> str:
        return f"""You are an expert {self.lesson_data.target_language} teacher conducting a personalized lesson.

LESSON DETAILS:
- Title: {self.lesson_data.title}
- Target Language: {self.lesson_data.target_language}
- Student's Native Language: {self.lesson_data.native_language}
- Duration: {self.lesson_data.estimated_duration} minutes
- Content: {self.lesson_data.content}

LEARNING OBJECTIVES:
{chr(10).join(f"- {obj}" for obj in self.lesson_data.objectives)}

VOCABULARY TO TEACH:
{chr(10).join(f"- {word}" for word in self.lesson_data.vocabulary)}

GRAMMAR POINTS:
{chr(10).join(f"- {point}" for point in self.lesson_data.grammar)}

TEACHING METHODOLOGY:
1. Start with a warm introduction in the student's native language
2. Teach vocabulary word by word:
   - Present the word in {self.lesson_data.target_language}
   - Explain meaning and context
   - Have student repeat 2-3 times
   - Correct pronunciation if needed
   - Use the word in a simple sentence
3. Introduce grammar concepts step by step:
   - Explain the rule clearly
   - Provide examples
   - Have student practice with guided exercises
4. Conduct conversational practice using learned vocabulary and grammar
5. Assess understanding through questions and pronunciation checks
6. Provide comprehensive feedback

INTERACTION RULES:
- Be patient, encouraging, and supportive
- Speak clearly and at appropriate pace
- Always correct pronunciation mistakes gently
- Use positive reinforcement
- Ask the student to repeat words/phrases when pronunciation needs improvement
- Switch between {self.lesson_data.target_language} and {self.lesson_data.native_language} as needed for clarity
- Keep responses concise and focused
- Maintain an enthusiastic and friendly tone

CURRENT PHASE: Introduction - Welcome the student and explain what you'll learn today."""

    @function_tool
    async def advance_lesson_phase(self, context: RunContext) -> str:
        """Advance to the next phase of the lesson."""
        current_phase = self.progress.current_phase

        if current_phase == LessonPhase.INTRODUCTION:
            self.progress.current_phase = LessonPhase.VOCABULARY
            return f"Moving to vocabulary phase. Teaching {len(self.lesson_data.vocabulary)} words."
        elif current_phase == LessonPhase.VOCABULARY:
            if self.progress.vocabulary_index < len(self.lesson_data.vocabulary) - 1:
                self.progress.vocabulary_index += 1
                word = self.lesson_data.vocabulary[self.progress.vocabulary_index]
                return f"Next vocabulary word: {word}"
            else:
                self.progress.current_phase = LessonPhase.GRAMMAR
                return f"Vocabulary complete! Moving to grammar. Teaching {len(self.lesson_data.grammar)} concepts."
        elif current_phase == LessonPhase.GRAMMAR:
            if self.progress.grammar_index < len(self.lesson_data.grammar) - 1:
                self.progress.grammar_index += 1
                concept = self.lesson_data.grammar[self.progress.grammar_index]
                return f"Next grammar concept: {concept}"
            else:
                self.progress.current_phase = LessonPhase.PRACTICE
                return "Grammar complete! Moving to conversational practice."
        elif current_phase == LessonPhase.PRACTICE:
            self.progress.current_phase = LessonPhase.ASSESSMENT
            return "Practice complete! Starting final assessment."
        elif current_phase == LessonPhase.ASSESSMENT:
            self.progress.current_phase = LessonPhase.FEEDBACK
            return "Assessment complete! Preparing final feedback."
        else:
            return "Lesson completed!"

    @function_tool
    async def record_pronunciation_attempt(
        self, context: RunContext, word: str, is_correct: bool, attempt_number: int
    ) -> str:
        """Record student's pronunciation attempt."""
        if word not in self.progress.pronunciation_attempts:
            self.progress.pronunciation_attempts[word] = 0

        self.progress.pronunciation_attempts[word] = attempt_number
        self.progress.correct_pronunciations[word] = is_correct

        if is_correct:
            return f"Excellent pronunciation of '{word}'! Moving on."
        else:
            if attempt_number < 3:
                return f"Let's try '{word}' again. Listen carefully to my pronunciation and repeat."
            else:
                self.progress.mistakes.append(
                    f"Pronunciation difficulty with '{word}'")
                return f"We'll practice '{word}' more later. For now, let's continue."

    @function_tool
    async def update_lesson_score(
        self, context: RunContext, category: str, score: float, reason: str
    ) -> str:
        """Update the lesson score for a specific category."""
        if category in self.progress.lesson_score:
            self.progress.lesson_score[category] = max(0.0, min(10.0, score))
            logger.info(f"Updated {category} score to {score}: {reason}")
            return f"Score updated: {category} = {score}/10"
        return f"Invalid category: {category}"

    @function_tool
    async def get_current_lesson_status(self, context: RunContext) -> str:
        """Get current lesson progress and status."""
        phase = self.progress.current_phase.value
        vocab_progress = f"{self.progress.vocabulary_index + 1}/{len(self.lesson_data.vocabulary)}"
        grammar_progress = f"{self.progress.grammar_index + 1}/{len(self.lesson_data.grammar)}"

        return f"""Current Status:
Phase: {phase}
Vocabulary Progress: {vocab_progress}
Grammar Progress: {grammar_progress}
Current Scores: {self.progress.lesson_score}
Pronunciation Attempts: {len(self.progress.pronunciation_attempts)}"""

    @function_tool
    async def generate_lesson_feedback(self, context: RunContext) -> str:
        """Generate comprehensive lesson feedback."""
        total_score = sum(self.progress.lesson_score.values()
                          ) / len(self.progress.lesson_score)
        passed = total_score >= 6.0  # 60% to pass

        vocab_learned = sum(1 for word in self.lesson_data.vocabulary
                            if word in self.progress.correct_pronunciations
                            and self.progress.correct_pronunciations[word])

        feedback = {
            "lesson_id": self.lesson_data.lesson_id,
            "total_score": round(total_score, 1),
            "passed": passed,
            "category_scores": self.progress.lesson_score,
            "vocabulary_learned": vocab_learned,
            "total_vocabulary": len(self.lesson_data.vocabulary),
            "pronunciation_attempts": self.progress.pronunciation_attempts,
            "areas_for_improvement": self.progress.mistakes,
            "duration_minutes": self.lesson_data.estimated_duration,
            "recommendations": self._generate_recommendations(total_score)
        }

        logger.info(f"Lesson feedback generated: {feedback}")
        return json.dumps(feedback, indent=2)

    def _generate_recommendations(self, score: float) -> List[str]:
        """Generate personalized recommendations based on performance."""
        recommendations = []

        if score >= 8.0:
            recommendations.append(
                "Excellent work! You're ready for the next lesson.")
            recommendations.append("Consider practicing with native speakers.")
        elif score >= 6.0:
            recommendations.append(
                "Good progress! Review vocabulary before the next lesson.")
            recommendations.append(
                "Practice pronunciation of difficult words.")
        else:
            recommendations.append(
                "Repeat this lesson for better understanding.")
            recommendations.append("Focus on vocabulary memorization.")
            recommendations.append("Practice pronunciation daily.")

        if self.progress.lesson_score.get("pronunciation", 0) < 6.0:
            recommendations.append(
                "Use pronunciation apps for extra practice.")

        if self.progress.lesson_score.get("grammar", 0) < 6.0:
            recommendations.append(
                "Review grammar rules and do extra exercises.")

        return recommendations


def prewarm(proc: JobProcess):
    """Prewarm the process with necessary models."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the language learning agent."""
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Extract lesson data from room metadata
    lesson_data = None
    if ctx.room.metadata:
        try:
            metadata = json.loads(ctx.room.metadata)
            lesson_data = LessonData(
                lesson_id=metadata.get("lessonId", ""),
                course_id=metadata.get("courseId", ""),
                title=metadata.get("title", "Language Lesson"),
                target_language=metadata.get("targetLanguage", ""),
                language_code=metadata.get("languageCode", ""),
                content=metadata.get("content", ""),
                objectives=metadata.get("objectives", []),
                vocabulary=metadata.get("vocabulary", []),
                grammar=metadata.get("grammar", []),
                native_language=metadata.get("nativeLanguage", "English"),
                estimated_duration=metadata.get("estimatedDuration", 10)
            )
            logger.info(f"Loaded lesson data: {lesson_data.title}")
        except Exception as e:
            logger.error(f"Failed to parse lesson metadata: {e}")

    if not lesson_data:
        # Fallback to default lesson
        lesson_data = LessonData(
            lesson_id="default",
            course_id="default",
            title="Basic Greetings",
            target_language="German",
            language_code="de",
            content="Learn basic German greetings and introductions",
            objectives=["Learn basic greetings", "Practice pronunciation"],
            vocabulary=["Hallo", "Guten Tag", "Guten Morgen",
                        "Guten Abend", "Wie geht es Ihnen?"],
            grammar=["Formal vs informal speech"],
            native_language="English",
            estimated_duration=10
        )

    # Set up the AI session with language-specific models
    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        stt=deepgram.STT(
            model="nova-3",
            language=lesson_data.language_code if lesson_data.language_code != "multi" else "multi"
        ),
        tts=cartesia.TTS(
            voice="6f84f4b8-58a2-430c-8c79-688dad597532",  # Can be customized per language
            language=lesson_data.language_code
        ),
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
        logger.info(f"Usage summary: {summary}")

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

    # Connect to the room
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
