import { useState, useEffect, useRef } from 'react';
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
  const [webglContextLost, setWebglContextLost] = useState(false);
  
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
  const { detect, segment, isInitialized, error: humanError, reinitialize } = useHumanDetection(videoRef.current);
  
  // Track if we were tracking before context loss
  const wasTrackingBeforeContextLossRef = useRef(false);
  
  // Detection loop with FPS tracking
  const {
    detectionResultRef,
    prevSkeletonPartsRef,
    detectionFps,
    clearCache: clearDetectionCache,
  } = useDetectionLoop({
    isInitialized,
    isCameraActive,
    isTrackingEnabled: isTrackingEnabled && !webglContextLost,
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
    isTrackingEnabled: isTrackingEnabled && !webglContextLost,
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
    isTrackingEnabled: isTrackingEnabled && !webglContextLost,
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

  // WebGL context loss/restoration handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    const segCanvas = segmentationCanvasRef.current;
    
    if (!canvas || !segCanvas) return;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.error('[WebGL] Context lost - pausing tracking');
      
      // Save tracking state
      wasTrackingBeforeContextLossRef.current = isTrackingEnabled;
      
      // Pause tracking
      setWebglContextLost(true);
      
      // Clear all caches
      clearDetectionCache();
      clearSegmentationCache();
      setShoulderAngle(null);
      
      // Clear canvases
      const ctx = canvas.getContext('2d');
      const segCtx = segCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (segCtx) segCtx.clearRect(0, 0, segCanvas.width, segCanvas.height);
      
      console.log('[WebGL] Context loss handled - tracking paused, caches cleared');
    };

    const handleContextRestored = async () => {
      console.log('[WebGL] Context restored - reinitializing...');
      
      try {
        // Reinitialize Human.js models
        await reinitialize();
        
        // Restore tracking state
        setWebglContextLost(false);
        
        console.log('[WebGL] Context restoration complete - tracking resumed');
      } catch (error) {
        console.error('[WebGL] Failed to restore context:', error);
      }
    };

    // Add event listeners to both canvases
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    segCanvas.addEventListener('webglcontextlost', handleContextLost);
    segCanvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      segCanvas.removeEventListener('webglcontextlost', handleContextLost);
      segCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [canvasRef.current, segmentationCanvasRef.current, isTrackingEnabled, clearDetectionCache, clearSegmentationCache, reinitialize]);

  const toggleTracking = () => {
    if (webglContextLost) {
      console.warn('[Tracking] Cannot toggle - WebGL context lost');
      return;
    }
    
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
    if (webglContextLost) {
      console.warn('[Video Overlay] Cannot toggle - WebGL context lost');
      return;
    }
    
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
        isTrackingEnabled={isTrackingEnabled && !webglContextLost}
        isSkeletonVisible={isSkeletonVisible}
        isVideoOverlayEnabled={isVideoOverlayEnabled}
        shoulderAngle={shoulderAngle}
        heading={pov.heading}
        detectionFps={detectionFps}
        segmentationFps={segmentationFps}
        renderFps={renderFps}
        webglContextLost={webglContextLost}
        onToggleTracking={toggleTracking}
        onToggleSkeletonVisibility={toggleSkeletonVisibility}
        onToggleVideoOverlay={toggleVideoOverlay}
      />
    </>
  );
};
