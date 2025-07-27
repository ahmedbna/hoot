import { useCallback, useEffect, useState } from 'react';
import {
  ConnectionDetails,
  LessonData,
} from '@/app/api/connection-details/route';

export default function useConnectionDetails() {
  // Generate room connection details, including:
  //   - A random Room name
  //   - A random Participant name
  //   - An Access Token to permit the participant to join the room
  //   - The URL of the LiveKit server to connect to
  //
  // In real-world application, you would likely allow the user to specify their
  // own participant name, and possibly to choose from existing rooms to join.

  const [connectionDetails, setConnectionDetails] =
    useState<ConnectionDetails | null>(null);

  const fetchConnectionDetails = useCallback(
    async (lessonData?: LessonData) => {
      setConnectionDetails(null);

      try {
        const url = new URL(
          process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
            '/api/connection-details',
          window.location.origin
        );

        let response;

        if (lessonData) {
          // POST request with lesson data
          response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lessonData }),
          });
        } else {
          // GET request (original behavior)
          response = await fetch(url.toString());
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setConnectionDetails(data);
      } catch (error) {
        console.error('Error fetching connection details:', error);
        setConnectionDetails(null);
      }
    },
    []
  );

  // Keep the original behavior for backward compatibility
  useEffect(() => {
    fetchConnectionDetails();
  }, [fetchConnectionDetails]);

  return {
    connectionDetails,
    refreshConnectionDetails: fetchConnectionDetails,
  };
}
