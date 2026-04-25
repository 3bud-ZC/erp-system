import { useRef, useCallback } from 'react';

/**
 * Hook to prevent duplicate async operations
 * Ensures only one operation runs at a time
 */
export function usePreventDuplicate() {
  const isProcessing = useRef(false);

  const execute = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (isProcessing.current) {
      console.warn('Operation already in progress, skipping duplicate request');
      return null;
    }

    isProcessing.current = true;
    try {
      const result = await fn();
      return result;
    } finally {
      isProcessing.current = false;
    }
  }, []);

  return { execute, isProcessing: isProcessing.current };
}
