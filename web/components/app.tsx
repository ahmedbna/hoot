'use client';

import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
} from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { SessionView } from '@/components/session-view';
import { Welcome } from '@/components/welcome';
import useConnectionDetails from '@/hooks/useConnectionDetails';
import type { AppConfig } from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { LessonData } from '@/app/api/connection-details/route';

interface AppProps {
  lessonId: Id<'lessons'>;
  appConfig: AppConfig;
}

export function App({ appConfig, lessonId }: AppProps) {
  const lesson = useQuery(api.lessons.get, { lessonId });

  const room = useMemo(() => new Room(), []);
  const [sessionStarted, setSessionStarted] = useState(false);
  const { connectionDetails, refreshConnectionDetails } =
    useConnectionDetails();

  // Prepare lesson data for the agent
  const lessonData: LessonData | undefined = useMemo(() => {
    if (!lesson) return undefined;

    return {
      title: lesson.title,
      description: lesson.description,
      objectives: lesson.objectives,
      vocabulary: lesson.vocabulary,
      phrases: lesson.phrases,
      grammar: lesson.grammar,
      duration: lesson.duration,
      learningLanguage: lesson.enroll.learningLanguage,
      nativeLanguage: lesson.enroll.nativeLanguage,
    };
  }, [lesson]);

  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      // Don't automatically refresh on disconnect - let the user manually start again
    };
    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room]);

  // Handle session start - this is where we pass lesson data
  const handleStartSession = async () => {
    if (!lessonData) {
      toastAlert({
        title: 'Lesson data not available',
        description: 'Please wait for the lesson to load before starting.',
      });
      return;
    }

    try {
      // Refresh connection details with lesson data
      await refreshConnectionDetails(lessonData);
      setSessionStarted(true);
    } catch (error) {
      toastAlert({
        title: 'Failed to start session',
        description: 'Please try again.',
      });
    }
  };

  useEffect(() => {
    let aborted = false;
    if (sessionStarted && room.state === 'disconnected' && connectionDetails) {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        room.connect(
          connectionDetails.serverUrl,
          connectionDetails.participantToken
        ),
      ]).catch((error) => {
        if (aborted) {
          // Once the effect has cleaned up after itself, drop any errors
          //
          // These errors are likely caused by this effect rerunning rapidly,
          // resulting in a previous run `disconnect` running in parallel with
          // a current run `connect`
          return;
        }

        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
      });
    }
    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [
    room,
    sessionStarted,
    connectionDetails,
    appConfig.isPreConnectBufferEnabled,
  ]);

  if (lesson === undefined) {
    return (
      <div className='flex h-full items-center justify-center'>
        <p className='text-lg'>Loading...</p>
      </div>
    );
  }

  if (lesson === null) {
    return (
      <div className='flex h-full items-center justify-center'>
        <p className='text-lg'>Lesson not found</p>
      </div>
    );
  }

  const lessonDetails = {
    title: lesson.title,
    description: lesson.description,
    objectives: lesson.objectives,
    vocabulary: lesson.vocabulary,
    phrases: lesson.phrases,
    grammar: lesson.grammar,
    duration: lesson.duration,
    learningLanguage: lesson.enroll.learningLanguage,
    nativeLanguage: lesson.enroll.nativeLanguage,
  };

  return (
    <>
      {sessionStarted ? (
        <RoomContext.Provider value={room}>
          <RoomAudioRenderer />
          <StartAudio label='Start Audio' />

          <SessionView
            key='session-view'
            appConfig={appConfig}
            disabled={!sessionStarted}
            sessionStarted={sessionStarted}
          />
        </RoomContext.Provider>
      ) : (
        <Welcome
          key='welcome'
          lesson={lessonDetails}
          disabled={sessionStarted || !lessonData}
          onStartCall={handleStartSession}
        />
      )}
    </>
  );
}
