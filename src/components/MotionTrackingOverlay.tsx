import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { useCamera } from '@/hooks/useCamera';
import { useCanvasSetup } from '@/hooks/useCanvasSetup';
import { useDetectionLoop } from '@/hooks/useDetectionLoop';
import { useRenderLoop } from '@/hooks/useRenderLoop';
import { TrackingControls } from './TrackingControls';

export const MotionTrackingOverlay = () => {
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(true);
  const [shoulderAngle, setShoulderAngle] = useState<number | null>(null);
  
  const { pov } = useSelector((state: RootState) => state.streetView);
  
  // Initialize camera
  const { videoRef, cameraError, isCameraActive } = useCamera();
  
  // Initialize canvas system
  const {
    canvasRef,
    offscreenCanvasRef,
    offscreenCtxRef,
    segmentationCanvasRef,
    segmentationCtxRef,
  } = useCanvasSetup();
  
  // Initialize human detection
  const { detect, segment, isInitialized, error: humanError } = useHumanDetection(videoRef.current);
  
  // Detection loop
  const {
    detectionResultRef,
    segmentationDataRef,
    prevSkeletonPartsRef,
    clearCache,
  } = useDetectionLoop({
    isInitialized,
    isCameraActive,
    isTrackingEnabled,
    videoElement: videoRef.current,
    detect,
    segment,
    onShoulderAngleChange: setShoulderAngle,
  });
  
  // Render loop
  useRenderLoop({
    isInitialized,
    isCameraActive,
    isTrackingEnabled,
    isSkeletonVisible,
    videoElement: videoRef.current,
    canvasElement: canvasRef.current,
    offscreenCanvas: offscreenCanvasRef.current,
    offscreenCtx: offscreenCtxRef.current,
    segmentationCanvas: segmentationCanvasRef.current,
    segmentationCtx: segmentationCtxRef.current,
    detectionResult: detectionResultRef,
    segmentationData: segmentationDataRef,
    cachedParts: prevSkeletonPartsRef,
  });

  const toggleTracking = () => {
    setIsTrackingEnabled(prev => {
      const newState = !prev;
      console.log('[Tracking] Toggle:', newState ? 'ON' : 'OFF');
      
      if (!newState) {
        clearCache();
        setShoulderAngle(null);
        console.log('[Persistence] Cache cleared - tracking disabled');
      }
      
      return newState;
    });
  };

  const toggleSkeletonVisibility = () => {
    setIsSkeletonVisible(prev => {
      const newState = !prev;
      console.log('[Skeleton] Visibility toggle:', newState ? 'VISIBLE' : 'HIDDEN');
      return newState;
    });
  };

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay={false}
      />

      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-40"
        style={{ background: 'transparent' }}
      />

      <TrackingControls
        cameraError={cameraError}
        humanError={humanError}
        isCameraActive={isCameraActive}
        isInitialized={isInitialized}
        isTrackingEnabled={isTrackingEnabled}
        isSkeletonVisible={isSkeletonVisible}
        shoulderAngle={shoulderAngle}
        heading={pov.heading}
        onToggleTracking={toggleTracking}
        onToggleSkeletonVisibility={toggleSkeletonVisibility}
      />
    </>
  );
};
