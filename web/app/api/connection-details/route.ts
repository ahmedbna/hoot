import { NextRequest, NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
  RoomServiceClient,
} from 'livekit-server-sdk';

// Environment variables
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Don't cache the results
export const revalidate = 0;

export type LessonData = {
  lessonId: string;
  courseId: string;
  title: string;
  targetLanguage: string;
  languageCode: string;
  content: string;
  objectives: string[];
  vocabulary: string[];
  grammar?: string[];
  nativeLanguage: string;
  estimatedDuration?: number;
};

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  sessionId: string;
};

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error('Missing required environment variables');
    }

    // Parse request body
    const body = await request.json();
    const {
      userId,
      lessonData,
      participantName = 'Student',
    }: {
      userId: string;
      lessonData: LessonData;
      participantName?: string;
    } = body;

    if (!userId || !lessonData) {
      return NextResponse.json(
        { error: 'Missing userId or lessonData' },
        { status: 400 }
      );
    }

    // Generate unique identifiers
    const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const roomName = `language_lesson_${userId}_${lessonData.lessonId}_${sessionId}`;
    const participantIdentity = `user_${userId}_${sessionId}`;

    // Create room service client for room management
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Prepare comprehensive room metadata with lesson information
    const roomMetadata = JSON.stringify({
      // Lesson Information
      lessonId: lessonData.lessonId,
      courseId: lessonData.courseId,
      title: lessonData.title,
      targetLanguage: lessonData.targetLanguage,
      languageCode: lessonData.languageCode,
      content: lessonData.content,
      objectives: lessonData.objectives,
      vocabulary: lessonData.vocabulary,
      grammar: lessonData.grammar || [],
      nativeLanguage: lessonData.nativeLanguage,
      estimatedDuration: lessonData.estimatedDuration || 10,

      // Session Information
      userId,
      sessionId,
      participantName,
      createdAt: Date.now(),

      // Teaching Configuration
      teachingMode: 'interactive',
      enablePronunciationCheck: true,
      enableRealTimeFeedback: true,
      maxPronunciationAttempts: 3,
      passingScore: 6.0,

      // AI Agent Configuration
      agentPersonality: 'encouraging_teacher',
      voiceSettings: {
        speed: 'normal',
        clarity: 'high',
        language: lessonData.languageCode,
      },
    });

    try {
      // Create room with comprehensive settings
      await roomService.createRoom({
        name: roomName,
        metadata: roomMetadata,
        // Set room timeout based on estimated duration plus buffer
        emptyTimeout: Math.max(
          (lessonData.estimatedDuration || 10) * 60 + 600,
          900
        ), // Min 15 minutes
        maxParticipants: 2, // User + AI agent
        // Enable transcription for better learning experience
        nodeId: '', // Let LiveKit choose the best node
      });

      console.log(`Created room ${roomName} for lesson ${lessonData.lessonId}`);
    } catch (error) {
      // Room might already exist, try to update metadata
      try {
        await roomService.updateRoomMetadata(roomName, roomMetadata);
        console.log(`Updated metadata for existing room ${roomName}`);
      } catch (updateError) {
        console.warn('Failed to create or update room:', error);
        // Continue anyway, the agent can still work without room metadata
      }
    }

    // Generate participant token with appropriate permissions
    const participantToken = await createParticipantToken(
      {
        identity: participantIdentity,
        name: participantName,
        metadata: JSON.stringify({
          userId,
          lessonId: lessonData.lessonId,
          nativeLanguage: lessonData.nativeLanguage,
          targetLanguage: lessonData.targetLanguage,
          sessionType: 'language_lesson',
          isStudent: true,
        }),
      },
      roomName
    );

    // Prepare response
    const connectionDetails: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName,
      sessionId,
    };

    // Set no-cache headers
    const headers = new Headers({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return NextResponse.json(connectionDetails, { headers });
  } catch (error) {
    console.error('Error creating connection details:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enhanced GET endpoint for testing
export async function GET() {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error('Missing required environment variables');
    }

    const userId = `guest_${Math.floor(Math.random() * 10000)}`;
    const sessionId = `session_${Date.now()}`;
    const roomName = `language_lesson_${userId}_${sessionId}`;
    const participantIdentity = `user_${userId}_${sessionId}`;

    const participantToken = await createParticipantToken(
      {
        identity: participantIdentity,
        name: 'Guest Student',
        metadata: JSON.stringify({
          userId,
        }),
      },
      roomName
    );

    const connectionDetails: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName: 'Guest Student',
      sessionId,
    };

    const headers = new Headers({
      'Cache-Control': 'no-store',
    });

    return NextResponse.json(connectionDetails, { headers });
  } catch (error) {
    console.error('Error in GET connection details:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string
): Promise<string> {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Missing API credentials');
  }

  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '10m',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    // Additional permissions for language learning
    canUpdateOwnMetadata: true,
  };

  at.addGrant(grant);
  return Promise.resolve(at.toJwt());
}
