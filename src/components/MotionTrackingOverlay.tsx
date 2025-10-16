import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setVideoOverlayEnabled } from '@/store/streetViewSlice';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { useCamera } from '@/hooks/useCamera';
import { useCanvasSetup } from '@/hooks/useCanvasSetup';
import { useDetectionLoop } from '@/hooks/useDetectionLoop';
import { useSegmentationLoop } from '@/hooks/useSegmentationLoop';
import { useRenderLoop } from '@/hooks/useRenderLoop';
import { TrackingControls } from './TrackingControls';

export const MotionTrackingOverlay = () => {
  const dispatch = useDispatch();
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(false);
  const [shoulderAngle, setShoulderAngle] = useState<number | null>(null);
  
  const { pov, isVideoOverlayEnabled } = useSelector((state: RootState) => state.streetView);
  
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
  
  // Detection loop with FPS tracking
  const {
    detectionResultRef,
    prevSkeletonPartsRef,
    detectionFps,
    clearCache: clearDetectionCache,
  } = useDetectionLoop({
    isInitialized,
    isCameraActive,
    isTrackingEnabled,
    videoElement: videoRef.current,
    detect,
    onShoulderAngleChange: setShoulderAngle,
  });
  
  // Segmentation loop with FPS tracking (independent from detection)
  const {
    segmentationDataRef,
    segmentationFps,
    clearCache: clearSegmentationCache,
  } = useSegmentationLoop({
    isInitialized,
    isCameraActive,
    isTrackingEnabled,
    isVideoOverlayEnabled,
    videoElement: videoRef.current,
    segment,
    segmentationCanvas: segmentationCanvasRef.current,
    segmentationCtx: segmentationCtxRef.current,
  });
  
  // Render loop with FPS tracking
  const { renderFps } = useRenderLoop({
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
        clearDetectionCache();
        clearSegmentationCache();
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

  const toggleVideoOverlay = () => {
    dispatch(setVideoOverlayEnabled(!isVideoOverlayEnabled));
    if (isVideoOverlayEnabled) {
      clearSegmentationCache();
      console.log('[Video Overlay] Disabled - segmentation cache cleared');
    }
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
        isVideoOverlayEnabled={isVideoOverlayEnabled}
        shoulderAngle={shoulderAngle}
        heading={pov.heading}
        detectionFps={detectionFps}
        segmentationFps={segmentationFps}
        renderFps={renderFps}
        onToggleTracking={toggleTracking}
        onToggleSkeletonVisibility={toggleSkeletonVisibility}
        onToggleVideoOverlay={toggleVideoOverlay}
      />
    </>
  );
};
