
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useFullscreen() {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep React state synchronized with the browser, including
  // when the user exits fullscreen by pressing Escape.
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(
        document.fullscreenElement === containerRef.current
      );
    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  // Enter or exit fullscreen.
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;

    if (!container) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      await container.requestFullscreen();
    } catch (error) {
      console.error('Could not toggle viewer fullscreen:', error);
    }
  }, []);

  return {
    containerRef,
    isFullscreen,
    toggleFullscreen,
  };
}
