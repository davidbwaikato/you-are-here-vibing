// Custom hook for camera initialization and management

import { useEffect, useRef, useState } from 'react';

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializingRef = useRef(false);
  
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useEffect(() => {
    if (isInitializingRef.current || streamRef.current) {
      return;
    }

    isInitializingRef.current = true;
    console.log('[Camera] Starting initialization...');

    const initCamera = async () => {
      try {
        console.log('[Camera] Requesting media stream...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        console.log('[Camera] Media stream obtained');
        streamRef.current = mediaStream;

        if (videoRef.current) {
          console.log('[Camera] Setting video srcObject...');
          videoRef.current.srcObject = mediaStream;
          
          videoRef.current.onloadedmetadata = async () => {
            try {
              console.log('[Camera] Video metadata loaded, starting playback...');
              if (videoRef.current) {
                await videoRef.current.play();
                console.log('[Camera] Video playing ✓');
                setIsCameraActive(true);
              }
            } catch (playError) {
              console.error('[Camera] Video play error:', playError);
              setCameraError('Failed to start video playback');
            }
          };
        }
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Failed to access camera');
        console.error('[Camera] Access error:', err);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initCamera();

    return () => {
      console.log('[Camera] Cleaning up...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
      }
      isInitializingRef.current = false;
    };
  }, []);

  return {
    videoRef,
    cameraError,
    isCameraActive,
  };
};
