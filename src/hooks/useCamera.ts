import { useEffect, useRef, useState, useCallback } from 'react';

export const useCamera = (shouldBeActive: boolean) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAccessingCamera, setIsAccessingCamera] = useState(false);
  const [isReleasingCamera, setIsReleasingCamera] = useState(false);

  const stopCamera = useCallback(() => {
    console.log('[Camera] Stopping camera...');
    setIsReleasingCamera(true);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[Camera] Track stopped:', track.kind);
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsReleasingCamera(false);
    console.log('[Camera] Camera stopped and released');
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsAccessingCamera(true);
      setError(null);
      console.log('[Camera] Requesting camera access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      console.log('[Camera] Camera access granted');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });

        console.log('[Camera] Video stream ready');
        setIsCameraActive(true);
        setIsAccessingCamera(false);
        setError(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMsg);
      setIsCameraActive(false);
      setIsAccessingCamera(false);
      console.error('[Camera] Error:', err);
    }
  }, []);

  useEffect(() => {
    if (shouldBeActive && !isCameraActive && !isAccessingCamera) {
      startCamera();
    } else if (!shouldBeActive && isCameraActive && !isReleasingCamera) {
      stopCamera();
    }
  }, [shouldBeActive, isCameraActive, isAccessingCamera, isReleasingCamera, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('[Camera] Cleanup: Stream stopped on unmount');
      }
    };
  }, []);

  return { 
    videoRef, 
    error, 
    isCameraActive, 
    isAccessingCamera,
    isReleasingCamera,
  };
};
