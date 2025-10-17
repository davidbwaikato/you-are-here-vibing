import { useEffect, useRef, useState } from 'react';

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAccessingCamera, setIsAccessingCamera] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        setIsAccessingCamera(true);
        console.log('[Camera] Requesting camera access...');
        
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        console.log('[Camera] Camera access granted');

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
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log('[Camera] Stream stopped');
      }
    };
  }, []);

  return { videoRef, error, isCameraActive, isAccessingCamera };
};
