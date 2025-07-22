import logging
import json
from typing import Dict, Any, Optional

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

logger = logging.getLogger("language_agent")

load_dotenv()


class LanguageTeacherAgent(Agent):
    def __init__(self, lesson_data: Dict[str, Any]) -> None:
        self.lesson_data = lesson_data
        self.language_code = lesson_data.get('languageCode', 'de')
        self.native_language = lesson_data.get('nativeLanguage', 'English')
        self.target_language = lesson_data.get('targetLanguage', 'German')
        self.lesson_content = lesson_data.get('content', '')
        self.objectives = lesson_data.get('objectives', [])
        self.vocabulary = lesson_data.get('vocabulary', [])
        self.grammer = lesson_data.get('grammer', [])

        # Build dynamic instructions based on lesson data
        instructions = self._build_instructions()

        super().__init__(instructions=instructions)

    def _build_instructions(self) -> str:
        """Build dynamic instructions based on lesson data"""
        base_instructions = f"""
You are an AI language teacher specializing in {self.target_language}. Your name is Luna.

LESSON CONTEXT:
- Target Language: {self.target_language}
- Student's Native Language: {self.native_language}
- Lesson Content: {self.lesson_content}

LEARNING OBJECTIVES:
{chr(10).join(f"- {obj}" for obj in self.objectives)}

VOCABULARY TO COVER:
{chr(10).join(f"- {obj}" for obj in self.vocabulary)}

GRAMMER TO COVER:
{chr(10).join(f"- {obj}" for obj in self.grammer)}

TEACHING APPROACH:
1. Speak primarily in {self.target_language}, but use {self.native_language} for explanations when needed
2. Encourage the student to speak in {self.target_language}
3. Correct pronunciation and grammar gently
4. Use the vocabulary words naturally in conversation
5. Ask questions to check understanding
6. Be patient and encouraging
7. Adapt your speaking speed to the student's level
8. Provide cultural context when appropriate

CONVERSATION FLOW:
1. Start by greeting the student and introducing today's lesson
2. Review any vocabulary if this is the beginning
3. Guide the conversation to cover the lesson objectives
4. Practice pronunciation of new words
5. Engage in role-play or conversational practice
6. Summarize what was learned at the end

Remember: You are a supportive teacher. Always be encouraging and create a safe space for learning.
"""
        return base_instructions

    @function_tool
    async def provide_translation(self, context: RunContext, text: str) -> str:
        """Provide translation of text from target language to native language.

        Args:
            text: The text in the target language that needs translation
        """
        logger.info(f"Providing translation for: {text}")

        # In a real implementation, you would use a translation service
        # For now, return a placeholder response
        return f"Translation requested for: '{text}'. This would be translated to {self.native_language}."

    @function_tool
    async def check_pronunciation(self, context: RunContext, word: str) -> str:
        """Provide pronunciation feedback for a specific word.

        Args:
            word: The word to check pronunciation for
        """
        logger.info(f"Checking pronunciation for: {word}")

        # Find the word in vocabulary if available
        for vocab_item in self.vocabulary:
            if vocab_item['word'].lower() == word.lower():
                pronunciation = vocab_item.get('pronunciation', '')
                return f"The word '{word}' is pronounced: {pronunciation}. Try saying it again!"

        return f"Let me help you with the pronunciation of '{word}'. Try breaking it down syllable by syllable."

    @function_tool
    async def explain_grammar(self, context: RunContext, topic: str) -> str:
        """Explain a grammar concept in the target language.

        Args:
            topic: The grammar topic to explain
        """
        logger.info(f"Explaining grammar topic: {topic}")

        return f"Let me explain {topic} in {self.target_language}. This is an important grammar concept that will help you communicate more effectively."

    @function_tool
    async def suggest_practice_activity(self, context: RunContext) -> str:
        """Suggest a practice activity based on the current lesson."""
        logger.info("Suggesting practice activity")

        activities = [
            "Let's practice using the new vocabulary in sentences",
            "How about we do a role-play conversation?",
            "Let's practice pronunciation of the key words",
            "Would you like to try describing something using today's vocabulary?",
            "Let's have a conversation about the lesson topic"
        ]

        # In a real implementation, you could select based on lesson progress
        return f"Here's a good activity for you: {activities[0]}"

    @function_tool
    async def record_progress(self, context: RunContext, skill_area: str, performance: str) -> str:
        """Record student's progress in a specific skill area.

        Args:
            skill_area: The skill being assessed (pronunciation, vocabulary, grammar, etc.)
            performance: Description of the student's performance
        """
        logger.info(f"Recording progress - {skill_area}: {performance}")

        # This would integrate with your database to record progress
        return f"Great work! I've noted your progress in {skill_area}."


def prewarm(proc: JobProcess):
    """Prewarm function to load models before session starts"""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the language learning agent"""

    # Extract lesson data from room metadata
    room_metadata = ctx.room.metadata
    lesson_data = {}

    try:
        if room_metadata:
            lesson_data = json.loads(room_metadata)
            logger.info(f"Loaded lesson data: {lesson_data}")
    except json.JSONDecodeError:
        logger.warning(
            "Failed to parse room metadata, using default lesson data")
        lesson_data = {
            'targetLanguage': 'French',
            'languageCode': 'fr',
            'content': 'Basic greetings and introductions',
            'objectives': ['Learn basic greetings', 'Practice introductions'],
            'vocabulary': [
                {'word': 'bonjour', 'translation': 'hello',
                    'pronunciation': 'bone-ZHOOR'},
                {'word': 'au revoir', 'translation': 'goodbye',
                    'pronunciation': 'oh ruh-VWAHR'}
            ],
            'userLevel': 'beginner',
            'nativeLanguage': 'English'
        }

    # Set up logging context
    ctx.log_context_fields = {
        "room": ctx.room.name,
        "language": lesson_data.get('targetLanguage', 'Unknown'),
        "lesson": lesson_data.get('content', 'Unknown')
    }

    # Determine the target language for STT configuration
    language_code = lesson_data.get('languageCode', 'en')

    # Configure STT for multilingual support
    stt_language = 'multi' if language_code != 'en' else 'en'

    # Set up the agent session with appropriate language models
    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        stt=deepgram.STT(model="nova-3", language=stt_language),
        tts=cartesia.TTS(),
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
        logger.info(f"Session usage summary: {summary}")

    # Register shutdown callback
    ctx.add_shutdown_callback(log_usage)

    # Start the agent session
    await session.start(
        agent=LanguageTeacherAgent(lesson_data),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        room_output_options=RoomOutputOptions(
            transcription_enabled=True,
            # Enable transcription in both languages if needed
        ),
    )

    logger.info(
        f"Language teacher agent started for {lesson_data.get('targetLanguage', 'Unknown')} lesson")

    # Connect to the room
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
