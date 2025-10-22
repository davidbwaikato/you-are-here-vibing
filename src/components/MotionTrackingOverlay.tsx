import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setVideoOverlayEnabled, setSelectedMarkerIndex, setFistTrackingActive } from '@/store/streetViewSlice';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { useCamera } from '@/hooks/useCamera';
import { useCanvasSetup } from '@/hooks/useCanvasSetup';
import { useDetectionLoop } from '@/hooks/useDetectionLoop';
import { useSegmentationLoop } from '@/hooks/useSegmentationLoop';
import { useRenderLoop } from '@/hooks/useRenderLoop';
import { TrackingControls } from './TrackingControls';

interface MotionTrackingOverlayProps {
  panoramaRef: React.MutableRefObject<google.maps.StreetViewPanorama | null>;
  onTeleportToMarker?: (markerIndex: number) => void;
}

export const MotionTrackingOverlay = ({ panoramaRef, onTeleportToMarker }: MotionTrackingOverlayProps) => {
  const dispatch = useDispatch();
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(false);
  const [shoulderAngle, setShoulderAngle] = useState<number | null>(null);
  const [webglContextLost, setWebglContextLost] = useState(false);
  
  const { pov, isVideoOverlayEnabled, selectedMarkerIndex } = useSelector((state: RootState) => state.streetView);
  
  // Initialize camera with dynamic control
  const { 
    videoRef, 
    error: cameraError, 
    isCameraActive, 
    isAccessingCamera,
    isReleasingCamera,
  } = useCamera(isTrackingEnabled);
  
  // Initialize canvas system
  const {
    canvasRef,
    offscreenCanvasRef,
    offscreenCtxRef,
    segmentationCanvasRef,
    segmentationCtxRef,
  } = useCanvasSetup();
  
  // Initialize human detection
  const { detect, segment, isInitialized, error: humanError, reinitialize, isInitializing } = useHumanDetection(videoRef.current);
  
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
    canvasElement: canvasRef.current,
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
  useRenderLoop({
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

  // Fist gesture tracking state
  const trackedHandRef = useRef<'left' | 'right' | null>(null);
  const lastFistTopYRef = useRef<number | null>(null);
  const wasFistBeforeDisappearRef = useRef<boolean>(false);
  
  // Constants for fist tracking
  const FIST_VERTICAL_THRESHOLD = 50; // Same as middle-mouse drag threshold

  // Sync Redux selectedMarkerIndex with local ref when changed externally (e.g., by mouse)
  const selectedMarkerIndexRef = useRef<number>(selectedMarkerIndex);
  useEffect(() => {
    selectedMarkerIndexRef.current = selectedMarkerIndex;
    console.log('[Fist Tracking] Redux selectedMarkerIndex synced to ref:', selectedMarkerIndex);
  }, [selectedMarkerIndex]);

  // Fist gesture tracking effect
  useEffect(() => {
    if (!isInitialized || !isCameraActive || !isTrackingEnabled || webglContextLost) {
      // Reset tracking state when conditions not met
      if (trackedHandRef.current !== null) {
        console.log('[Fist Tracking] Conditions not met - resetting tracking state');
        trackedHandRef.current = null;
        lastFistTopYRef.current = null;
        wasFistBeforeDisappearRef.current = false;
        dispatch(setFistTrackingActive(false));
      }
      return;
    }

    // Run fist tracking logic on every render
    const checkFistGesture = () => {
      const result = detectionResultRef.current;
      if (!result) return;

      const leftFist = result.leftHand.detected && result.leftHand.isFist;
      const rightFist = result.rightHand.detected && result.rightHand.isFist;

      // Case 1: Both fists clenched - no tracking (reserved for future feature)
      if (leftFist && rightFist) {
        if (trackedHandRef.current !== null) {
          console.log('[Fist Tracking] Both fists detected - pausing tracking');
          trackedHandRef.current = null;
          lastFistTopYRef.current = null;
          wasFistBeforeDisappearRef.current = false;
          dispatch(setFistTrackingActive(false));
        }
        return;
      }

      // Case 2: Single fist detected
      if (leftFist || rightFist) {
        const currentHand = leftFist ? 'left' : 'right';
        const handData = leftFist ? result.leftHand : result.rightHand;

        // Start tracking new hand
        if (trackedHandRef.current === null) {
          if (handData.boundingBox) {
            const [, minY] = handData.boundingBox;
            trackedHandRef.current = currentHand;
            lastFistTopYRef.current = minY;
            wasFistBeforeDisappearRef.current = true;
            dispatch(setFistTrackingActive(true));
            console.log(`[Fist Tracking] Started tracking ${currentHand} hand at Y=${minY.toFixed(1)}`);
          }
          return;
        }

        // Continue tracking same hand
        if (trackedHandRef.current === currentHand) {
          if (handData.boundingBox && lastFistTopYRef.current !== null) {
            const [, currentMinY] = handData.boundingBox;
            const deltaY = currentMinY - lastFistTopYRef.current;

            // Check if movement exceeds threshold
            if (Math.abs(deltaY) >= FIST_VERTICAL_THRESHOLD) {
              // Vertical up = move forward in route (negative deltaY)
              // Vertical down = move backward in route (positive deltaY)
              const direction = deltaY < 0 ? 'forward' : 'backward';
              const steps = Math.floor(Math.abs(deltaY) / FIST_VERTICAL_THRESHOLD);

              console.log(`[Fist Tracking] ${currentHand} hand moved ${direction} by ${Math.abs(deltaY).toFixed(1)}px (${steps} steps)`);

              // Calculate new marker index
              let newIndex = selectedMarkerIndexRef.current;
              if (direction === 'forward') {
                newIndex = selectedMarkerIndexRef.current + steps;
              } else {
                newIndex = Math.max(selectedMarkerIndexRef.current - steps, 0);
              }

              // Update Redux state (will be clamped in ThreeJsCanvas based on actual marker count)
              dispatch(setSelectedMarkerIndex(newIndex));
              console.log(`[Fist Tracking] Dispatched setSelectedMarkerIndex: ${newIndex}`);

              // Update last position
              lastFistTopYRef.current = currentMinY;
            }

            wasFistBeforeDisappearRef.current = true;
          }
          return;
        }

        // Different hand detected - switch tracking
        if (handData.boundingBox) {
          const [, minY] = handData.boundingBox;
          console.log(`[Fist Tracking] Switched from ${trackedHandRef.current} to ${currentHand} hand at Y=${minY.toFixed(1)}`);
          trackedHandRef.current = currentHand;
          lastFistTopYRef.current = minY;
          wasFistBeforeDisappearRef.current = true;
        }
        return;
      }

      // Case 3: No fists detected
      if (!leftFist && !rightFist) {
        // Check if we were tracking a hand before
        if (trackedHandRef.current !== null) {
          const trackedHandData = trackedHandRef.current === 'left' ? result.leftHand : result.rightHand;

          // Sub-case 3a: Tracked hand disappeared but was fist before
          if (!trackedHandData.detected && wasFistBeforeDisappearRef.current) {
            console.log(`[Fist Tracking] ${trackedHandRef.current} hand disappeared - maintaining tracking state`);
            // Keep tracking state, wait for hand to reappear
            return;
          }

          // Sub-case 3b: Tracked hand reappeared and is now open
          if (trackedHandData.detected && !trackedHandData.isFist && wasFistBeforeDisappearRef.current) {
            console.log(`[Fist Tracking] ${trackedHandRef.current} hand opened - triggering teleport to marker ${selectedMarkerIndexRef.current}`);
            
            // Trigger teleport via callback
            if (onTeleportToMarker) {
							if (selectedMarkerIndexRef.current !== 0) {
                  console.log('[Fist Tracking] Calling onTeleportToMarker callback with index:', selectedMarkerIndexRef.current);
                  onTeleportToMarker(selectedMarkerIndexRef.current);
							}
            } else {
              console.warn('[Fist Tracking] onTeleportToMarker callback not provided!');
            }
            
            // Reset tracking state
            trackedHandRef.current = null;
            lastFistTopYRef.current = null;
            wasFistBeforeDisappearRef.current = false;
            dispatch(setFistTrackingActive(false));
            return;
          }

          // Sub-case 3c: Tracked hand reappeared but was never a fist (shouldn't happen, but handle gracefully)
          if (trackedHandData.detected && !trackedHandData.isFist && !wasFistBeforeDisappearRef.current) {
            console.log(`[Fist Tracking] ${trackedHandRef.current} hand detected but not a fist - resetting tracking`);
            trackedHandRef.current = null;
            lastFistTopYRef.current = null;
            wasFistBeforeDisappearRef.current = false;
            dispatch(setFistTrackingActive(false));
            return;
          }
        }
      }
    };

    // Run gesture check on animation frame for smooth tracking
    let animationFrameId: number;
    const gestureLoop = () => {
      checkFistGesture();
      animationFrameId = requestAnimationFrame(gestureLoop);
    };

    gestureLoop();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, webglContextLost, detectionResultRef, dispatch, onTeleportToMarker]);

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
      
      // Clear fist tracking state
      trackedHandRef.current = null;
      lastFistTopYRef.current = null;
      wasFistBeforeDisappearRef.current = false;
      dispatch(setFistTrackingActive(false));
      
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
  }, [canvasRef.current, segmentationCanvasRef.current, isTrackingEnabled, clearDetectionCache, clearSegmentationCache, reinitialize, dispatch]);

  const toggleTracking = () => {
    if (webglContextLost) {
      console.warn('[Tracking] Cannot toggle - WebGL context lost');
      return;
    }
    
    if (isAccessingCamera || isReleasingCamera) {
      console.warn('[Tracking] Cannot toggle - camera operation in progress');
      return;
    }
    
    setIsTrackingEnabled(prev => {
      const newState = !prev;
      console.log('[Tracking] Toggle:', newState ? 'ON (will acquire camera)' : 'OFF (will release camera)');
      
      if (!newState) {
        clearDetectionCache();
        clearSegmentationCache();
        setShoulderAngle(null);
        
        // Clear fist tracking state
        trackedHandRef.current = null;
        lastFistTopYRef.current = null;
        wasFistBeforeDisappearRef.current = false;
        dispatch(setFistTrackingActive(false));
        
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
        webglContextLost={webglContextLost}
        isInitializingModels={isInitializing}
        isAccessingCamera={isAccessingCamera}
        isReleasingCamera={isReleasingCamera}
        onToggleTracking={toggleTracking}
        onToggleSkeletonVisibility={toggleSkeletonVisibility}
        onToggleVideoOverlay={toggleVideoOverlay}
      />
    </>
  );
};
