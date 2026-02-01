import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT = 4 * 60 * 1000; // 4 minutes

export const useWakeLock = () => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');

        // Set timeout to auto-release after 4 minutes
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          releaseWakeLock();
        }, INACTIVITY_TIMEOUT);

        // Handle page visibility change
        const handleVisibilityChange = () => {
          if (document.hidden) {
            releaseWakeLock();
          } else {
            requestWakeLock();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    } catch (err) {
      console.error('Wake Lock request failed:', err);
    }
  };

  useEffect(() => {
    requestWakeLock();

    return () => {
      releaseWakeLock();
    };
  }, []);

  return { releaseWakeLock };
};

// Type definition for TypeScript
declare global {
  interface Navigator {
    wakeLock?: {
      request: (type: 'screen') => Promise<WakeLockSentinel>;
    };
  }
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}
