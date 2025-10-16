import { useEffect, useRef, useState, useCallback } from 'react';

// Dynamic import to avoid SSR issues
let Human: any = null;

export const useHumanDetection = (videoElement: HTMLVideoElement | null) => {
  const humanRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initHuman = async () => {
      try {
        console.log('[Human.js] Starting initialization...');
        
        // Dynamically import human.js
        if (!Human) {
          console.log('[Human.js] Importing module...');
          const module = await import('@vladmandic/human');
          Human = module.default || module.Human;
          console.log('[Human.js] Module imported successfully');
        }

        const config = {
          modelBasePath: "https://raw.githubusercontent.com/vladmandic/human-models/refs/heads/main/models/",
          face: {
            enabled: true,
            detector: { enabled: true, rotation: false },
            mesh: { enabled: false },
            iris: { enabled: false },
            description: { enabled: false },
            emotion: { enabled: false },
          },
          body: {
            enabled: true,
            modelPath: 'blazepose-full.json',
            maxDetected: 1,
          },
          hand: {
            enabled: true,
          },
          gesture: {
            enabled: true,
          },
          segmentation: {
            enabled: true,
            modelPath: 'selfie.json',
            mode: 'default',
          },
          filter: {
            enabled: true,
            equalization: false,
          },
        };

        console.log('[Human.js] Creating instance with BlazePose + Segmentation config:', config);
        humanRef.current = new Human(config);
        
        console.log('[Human.js] Loading models (BlazePose + Selfie segmentation)...');
        await humanRef.current.load();
        console.log('[Human.js] Models loaded successfully');
        
        console.log('[Human.js] Warming up...');
        await humanRef.current.warmup();
        console.log('[Human.js] Warmup complete');
        
        setIsInitialized(true);
        console.log('[Human.js] BlazePose + Segmentation initialization complete ✓');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Human.js';
        setError(errorMsg);
        console.error('[Human.js] Initialization error:', err);
      }
    };

    initHuman();
  }, []);

  const detect = useCallback(async () => {
    if (!humanRef.current || !videoElement || !isInitialized) {
      return null;
    }

    try {
      const result = await humanRef.current.detect(videoElement);
      return result;
    } catch (err) {
      console.error('[Human.js] Detection error:', err);
      return null;
    }
  }, [videoElement, isInitialized]);

  const segment = useCallback(async () => {
    if (!humanRef.current || !videoElement || !isInitialized) {
      return null;
    }

    try {
      const segmentationResult = await humanRef.current.segmentation(videoElement);
      return segmentationResult;
    } catch (err) {
      console.error('[Human.js] Segmentation error:', err);
      return null;
    }
  }, [videoElement, isInitialized]);

  return { human: humanRef.current, detect, segment, isInitialized, error };
};
