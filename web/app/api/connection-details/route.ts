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

    // Prepare room metadata with lesson information
    const roomMetadata = JSON.stringify({
      lessonId: lessonData.lessonId,
      courseId: lessonData.courseId,
      targetLanguage: lessonData.targetLanguage,
      languageCode: lessonData.languageCode,
      content: lessonData.content,
      objectives: lessonData.objectives,
      vocabulary: lessonData.vocabulary,
      grammar: lessonData.grammar,
      nativeLanguage: lessonData.nativeLanguage,
      estimatedDuration: lessonData.estimatedDuration,
      userId,
      sessionId,
      createdAt: Date.now(),
    });

    try {
      // Create or update room with metadata
      await roomService.createRoom({
        name: roomName,
        metadata: roomMetadata,
        // Set room timeout based on estimated duration or default to 1 hour
        emptyTimeout: (lessonData.estimatedDuration || 60) * 60 + 300, // Add 5 minutes buffer
        maxParticipants: 2, // User + AI agent
      });
    } catch (error) {
      // Room might already exist, try to update metadata
      try {
        await roomService.updateRoomMetadata(roomName, roomMetadata);
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

// Also support GET for backward compatibility (with limited functionality)
export async function GET() {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error('Missing required environment variables');
    }

    // Default lesson data for testing
    const defaultLessonData: LessonData = {
      lessonId: 'default_lesson',
      courseId: 'default_course',
      targetLanguage: 'French',
      languageCode: 'fr',
      content: 'Basic greetings and introductions in French',
      objectives: [
        'Learn basic French greetings',
        'Practice introducing yourself',
        'Understand formal vs informal speech',
      ],
      vocabulary: ['bonjour', 'bonsoir', 'au revoir', 'merci'],
      nativeLanguage: 'English',
      estimatedDuration: 15,
    };

    const userId = `guest_${Math.floor(Math.random() * 10000)}`;
    const sessionId = `session_${Date.now()}`;
    const roomName = `language_lesson_${userId}_${sessionId}`;
    const participantIdentity = `user_${userId}_${sessionId}`;

    const participantToken = await createParticipantToken(
      {
        identity: participantIdentity,
        name: 'Guest Student',
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
    ttl: '15m',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  at.addGrant(grant);
  return Promise.resolve(at.toJwt());
}
