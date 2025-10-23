import { useEffect, useRef, useState } from 'react';
import { processTensorToImageData } from '@/utils/tensorProcessing';
import {
  SEGMENTATION_INTERVAL_MS,
  LOG_INTERVAL_FRAMES,
} from '@/utils/constants';

// Logging control - set to false to disable segmentation logs
const DEBUG_SEGMENTATION = false;

interface UseSegmentationLoopProps {
  isInitialized: boolean;
  isCameraActive: boolean;
  isTrackingEnabled: boolean;
  isVideoOverlayEnabled: boolean;
  videoElement: HTMLVideoElement | null;
  segment: () => Promise<any>;
  segmentationCanvas: HTMLCanvasElement | null;
  segmentationCtx: CanvasRenderingContext2D | null;
}

export const useSegmentationLoop = ({
  isInitialized,
  isCameraActive,
  isTrackingEnabled,
  isVideoOverlayEnabled,
  videoElement,
  segment,
  segmentationCanvas,
  segmentationCtx,
}: UseSegmentationLoopProps) => {
  const segmentationDataRef = useRef<ImageData | null>(null);
  const isSegmentingRef = useRef(false);
  const segmentationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if overlay is enabled at the time of segmentation start
  const overlayEnabledAtStartRef = useRef(isVideoOverlayEnabled);
  // Track if tracking is enabled at the time of segmentation start
  const trackingEnabledAtStartRef = useRef(isTrackingEnabled);

  // FPS calculation state
  const [segmentationFps, setSegmentationFps] = useState<number>(0);
  const lastSegmentationTimeRef = useRef<number>(performance.now());
  const segmentationFrameTimesRef = useRef<number[]>([]);
  const FPS_SAMPLE_SIZE = 10;
  const segmentationCountRef = useRef(0);

  // Clear canvas when tracking is disabled or overlay is disabled
  useEffect(() => {
    if ((!isTrackingEnabled || !isVideoOverlayEnabled) && segmentationCanvas && segmentationCtx) {
      segmentationCtx.clearRect(0, 0, segmentationCanvas.width, segmentationCanvas.height);
      if (DEBUG_SEGMENTATION) {
        console.log('[Segmentation] Canvas cleared - tracking or overlay disabled');
      }
    }
  }, [isTrackingEnabled, isVideoOverlayEnabled, segmentationCanvas, segmentationCtx]);

  useEffect(() => {
    // Clear any existing interval first
    if (segmentationIntervalRef.current) {
      clearInterval(segmentationIntervalRef.current);
      segmentationIntervalRef.current = null;
    }

    if (!isInitialized || !isCameraActive || !isTrackingEnabled || !isVideoOverlayEnabled) {
      if (DEBUG_SEGMENTATION) {
        console.log('[Segmentation] Loop stopped - conditions not met:', {
          isInitialized,
          isCameraActive,
          isTrackingEnabled,
          isVideoOverlayEnabled
        });
      }
      
      setSegmentationFps(0);
      segmentationFrameTimesRef.current = [];
      segmentationCountRef.current = 0;
      segmentationDataRef.current = null;
      return;
    }

    if (DEBUG_SEGMENTATION) {
      console.log('[Segmentation] Starting segmentation loop...');
    }

    const runSegmentation = async () => {
      if (isSegmentingRef.current) {
        return;
      }
      
      isSegmentingRef.current = true;
      
      // Capture state at the start of this segmentation
      overlayEnabledAtStartRef.current = isVideoOverlayEnabled;
      trackingEnabledAtStartRef.current = isTrackingEnabled;
      
      let segmentationTensor: any = null;
      
      try {
        segmentationTensor = await segment();

        // CRITICAL: Check if tracking and overlay are still enabled after async segment() completes
        if (!trackingEnabledAtStartRef.current || !overlayEnabledAtStartRef.current) {
          if (DEBUG_SEGMENTATION) {
            console.log('[Segmentation] State changed during segment() - discarding result', {
              trackingEnabled: trackingEnabledAtStartRef.current,
              overlayEnabled: overlayEnabledAtStartRef.current
            });
          }
          return;
        }

        // Calculate FPS
        const currentTime = performance.now();
        const deltaTime = currentTime - lastSegmentationTimeRef.current;
        lastSegmentationTimeRef.current = currentTime;
        
        segmentationFrameTimesRef.current.push(deltaTime);
        if (segmentationFrameTimesRef.current.length > FPS_SAMPLE_SIZE) {
          segmentationFrameTimesRef.current.shift();
        }
        
        const avgDeltaTime = segmentationFrameTimesRef.current.reduce((a, b) => a + b, 0) / segmentationFrameTimesRef.current.length;
        const fps = 1000 / avgDeltaTime;
        setSegmentationFps(fps);

        // Process segmentation tensor to ImageData
        if (segmentationTensor && videoElement) {
          const imageData = await processTensorToImageData(
            segmentationTensor,
            videoElement.videoWidth,
            videoElement.videoHeight
          );
          
          // CRITICAL: Check again if tracking and overlay are still enabled after async processTensorToImageData() completes
          if (!trackingEnabledAtStartRef.current || !overlayEnabledAtStartRef.current) {
            if (DEBUG_SEGMENTATION) {
              console.log('[Segmentation] State changed during processTensorToImageData() - discarding result', {
                trackingEnabled: trackingEnabledAtStartRef.current,
                overlayEnabled: overlayEnabledAtStartRef.current
              });
            }
            return;
          }
          
          if (imageData) {
            segmentationDataRef.current = imageData;
          }
        }
        
        segmentationCountRef.current++;
        
        if (DEBUG_SEGMENTATION && segmentationCountRef.current % LOG_INTERVAL_FRAMES === 0) {
          console.log('[Segmentation] Frame:', segmentationCountRef.current, 'FPS:', fps.toFixed(1));
        }
      } catch (error) {
        console.error('[Segmentation] Error:', error);
      } finally {
        // CRITICAL: Dispose tensor to prevent GPU memory leak
        segmentationTensor.dispose();
        if (DEBUG_SEGMENTATION) {
          console.log('[Segmentation] Tensor disposed');
        }
        isSegmentingRef.current = false;
      }
    };

    segmentationIntervalRef.current = setInterval(runSegmentation, SEGMENTATION_INTERVAL_MS);
    
    if (DEBUG_SEGMENTATION) {
      console.log('[Segmentation] Loop started with interval:', SEGMENTATION_INTERVAL_MS, 'ms');
    }

    return () => {
      if (segmentationIntervalRef.current) {
        clearInterval(segmentationIntervalRef.current);
        segmentationIntervalRef.current = null;
        if (DEBUG_SEGMENTATION) {
          console.log('[Segmentation] Loop cleanup complete');
        }
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, isVideoOverlayEnabled, videoElement, segment, segmentationCanvas, segmentationCtx]);

  // Update the refs whenever state changes
  useEffect(() => {
    overlayEnabledAtStartRef.current = isVideoOverlayEnabled;
    trackingEnabledAtStartRef.current = isTrackingEnabled;
  }, [isVideoOverlayEnabled, isTrackingEnabled]);

  const clearCache = () => {
    segmentationDataRef.current = null;
    setSegmentationFps(0);
    segmentationFrameTimesRef.current = [];
    segmentationCountRef.current = 0;
    
    // Clear the canvas when clearing cache
    if (segmentationCanvas && segmentationCtx) {
      segmentationCtx.clearRect(0, 0, segmentationCanvas.width, segmentationCanvas.height);
      if (DEBUG_SEGMENTATION) {
        console.log('[Segmentation] Canvas cleared during cache clear');
      }
    }
  };

  return {
    segmentationDataRef,
    segmentationFps,
    clearCache,
  };
};
