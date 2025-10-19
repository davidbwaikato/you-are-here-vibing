import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPov } from '@/store/streetViewSlice';
import { HumanResult, CachedSkeletonParts } from '@/types/detection';
import { deepCopyFace, deepCopyBody, deepCopyHand } from '@/utils/cacheHelpers';
import { calculateShoulderAngle, normalizeHeading, calculateWrappedDelta } from '@/utils/shoulderTracking';
import {
  DETECTION_INTERVAL_MS,
  LOG_INTERVAL_FRAMES,
  HYSTERESIS_HEADING_ANGLE_THRESHOLD,
  INITIAL_HEADING,
  INITIAL_PITCH,
} from '@/utils/constants';

interface UseDetectionLoopProps {
  isInitialized: boolean;
  isCameraActive: boolean;
  isTrackingEnabled: boolean;
  videoElement: HTMLVideoElement | null;
  detect: () => Promise<any>;
  onShoulderAngleChange: (angle: number | null) => void;
  canvasElement: HTMLCanvasElement | null;
}

export const useDetectionLoop = ({
  isInitialized,
  isCameraActive,
  isTrackingEnabled,
  videoElement,
  detect,
  onShoulderAngleChange,
  canvasElement,
}: UseDetectionLoopProps) => {
  const dispatch = useDispatch();
  
  const detectionResultRef = useRef<HumanResult | null>(null);
  const isDetectingRef = useRef(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const prevSkeletonPartsRef = useRef<CachedSkeletonParts>({
    face: null,
    body: null,
    hand: null,
  });
  
  const baselineAngleRef = useRef<number | null>(null);
  const baseHeadingRef = useRef<number>(INITIAL_HEADING);
  const lastDispatchedHeadingRef = useRef<number>(INITIAL_HEADING);

  // Track if tracking is enabled at the time of detection start
  const trackingEnabledAtStartRef = useRef(isTrackingEnabled);

  // FPS calculation state
  const [detectionFps, setDetectionFps] = useState<number>(0);
  const lastDetectionTimeRef = useRef<number>(performance.now());
  const detectionFrameTimesRef = useRef<number[]>([]);
  const FPS_SAMPLE_SIZE = 10;
  const detectionCountRef = useRef(0);

  // Clear canvas when tracking is disabled
  useEffect(() => {
    if (!isTrackingEnabled && canvasElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        console.log('[Detection] Canvas cleared - tracking disabled');
      }
    }
  }, [isTrackingEnabled, canvasElement]);

  useEffect(() => {
    // Clear any existing interval first
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (!isInitialized || !isCameraActive || !isTrackingEnabled) {
      console.log('[Detection] Loop stopped - conditions not met:', {
        isInitialized,
        isCameraActive,
        isTrackingEnabled
      });
      setDetectionFps(0);
      detectionFrameTimesRef.current = [];
      detectionCountRef.current = 0;
      return;
    }

    console.log('[Detection] Starting detection loop...');

    const runDetection = async () => {
      if (isDetectingRef.current) {
        return;
      }
      
      isDetectingRef.current = true;
      
      // Capture tracking state at the start of this detection
      trackingEnabledAtStartRef.current = isTrackingEnabled;
      
      try {
        const result = await detect();

        // CRITICAL: Check if tracking is still enabled after async detect() completes
        if (!trackingEnabledAtStartRef.current) {
          console.log('[Detection] Tracking disabled during detect() - discarding result');
          isDetectingRef.current = false;
          return;
        }

        // Calculate FPS
        const currentTime = performance.now();
        const deltaTime = currentTime - lastDetectionTimeRef.current;
        lastDetectionTimeRef.current = currentTime;
        
        detectionFrameTimesRef.current.push(deltaTime);
        if (detectionFrameTimesRef.current.length > FPS_SAMPLE_SIZE) {
          detectionFrameTimesRef.current.shift();
        }
        
        const avgDeltaTime = detectionFrameTimesRef.current.reduce((a, b) => a + b, 0) / detectionFrameTimesRef.current.length;
        const fps = 1000 / avgDeltaTime;
        setDetectionFps(fps);
        
        // Cache detection results with deep copy
        if (result?.face && result.face.length > 0) {
          prevSkeletonPartsRef.current.face = deepCopyFace(result.face);
        }
        if (result?.body && result.body.length > 0) {
          prevSkeletonPartsRef.current.body = deepCopyBody(result.body);
        }
        if (result?.hand && result.hand.length > 0) {
          prevSkeletonPartsRef.current.hand = deepCopyHand(result.hand);
        }
        
        detectionResultRef.current = result as HumanResult;
        
        // Calculate shoulder swivel and update Street View heading
        if (result?.body?.[0]?.keypoints) {
          const currentAngle = calculateShoulderAngle(result.body[0].keypoints);
          
          if (currentAngle !== null) {
            // Set baseline on first valid detection
            if (baselineAngleRef.current === null) {
              baselineAngleRef.current = currentAngle;
              console.log('[Shoulder] ✓ Baseline swivel angle set:', currentAngle.toFixed(2), '°');
            }
						
            const angleDelta = currentAngle - baselineAngleRef.current;
            onShoulderAngleChange(angleDelta);
            
            const newHeading = baseHeadingRef.current - angleDelta;
            const normalizedHeading = normalizeHeading(newHeading);
            
            // Hysteresis check
            const wrappedDelta = calculateWrappedDelta(normalizedHeading, lastDispatchedHeadingRef.current);
            
            if (wrappedDelta >= HYSTERESIS_HEADING_ANGLE_THRESHOLD) {
              dispatch(setPov({
                heading: normalizedHeading,
                pitch: INITIAL_PITCH,
              }));
              
              lastDispatchedHeadingRef.current = normalizedHeading;
            }
          } else {
            onShoulderAngleChange(null);
          }
        } else {
          onShoulderAngleChange(null);
        }
        
        detectionCountRef.current++;
        
        if (detectionCountRef.current % LOG_INTERVAL_FRAMES === 0) {
          console.log('[Detection] Frame:', detectionCountRef.current, 'FPS:', fps.toFixed(1));
        }
      } catch (error) {
        console.error('[Detection] Error:', error);
      } finally {
        isDetectingRef.current = false;
      }
    };

    detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS);
    console.log('[Detection] Loop started with interval:', DETECTION_INTERVAL_MS, 'ms');

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        console.log('[Detection] Loop cleanup complete');
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, videoElement, detect, dispatch, onShoulderAngleChange]);

  // Update the ref whenever tracking state changes
  useEffect(() => {
    trackingEnabledAtStartRef.current = isTrackingEnabled;
  }, [isTrackingEnabled]);

  const clearCache = () => {
    detectionResultRef.current = null;
    baselineAngleRef.current = null;
    prevSkeletonPartsRef.current = {
      face: null,
      body: null,
      hand: null,
    };
    setDetectionFps(0);
    detectionFrameTimesRef.current = [];
    detectionCountRef.current = 0;
  };

  return {
    detectionResultRef,
    prevSkeletonPartsRef,
    detectionFps,
    clearCache,
  };
};
