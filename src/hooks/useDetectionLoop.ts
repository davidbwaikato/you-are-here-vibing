// Custom hook for detection loop management

import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { setPov } from '@/store/streetViewSlice';
import { HumanResult, CachedSkeletonParts } from '@/types/detection';
import { deepCopyFace, deepCopyBody, deepCopyHand } from '@/utils/cacheHelpers';
import { calculateShoulderAngle, normalizeHeading, calculateWrappedDelta } from '@/utils/shoulderTracking';
import { processTensorToImageData } from '@/utils/tensorProcessing';
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
  segment: () => Promise<any>;
  onShoulderAngleChange: (angle: number | null) => void;
}

export const useDetectionLoop = ({
  isInitialized,
  isCameraActive,
  isTrackingEnabled,
  videoElement,
  detect,
  segment,
  onShoulderAngleChange,
}: UseDetectionLoopProps) => {
  const dispatch = useDispatch();
  
  const detectionResultRef = useRef<HumanResult | null>(null);
  const segmentationDataRef = useRef<ImageData | null>(null);
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

  useEffect(() => {
    if (!isInitialized || !isCameraActive || !isTrackingEnabled) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        console.log('[Detection] Loop stopped - tracking disabled');
      }
      return;
    }

    console.log('[Detection] Starting detection loop with segmentation...');
    let detectionCount = 0;

    const runDetection = async () => {
      if (isDetectingRef.current) return;
      isDetectingRef.current = true;
      
      try {
        // Run detection and segmentation in parallel
        const [result, segmentationTensor] = await Promise.all([
          detect(),
          segment()
        ]);

        // Process segmentation tensor to ImageData
        if (segmentationTensor && videoElement) {
          const imageData = await processTensorToImageData(
            segmentationTensor,
            videoElement.videoWidth,
            videoElement.videoHeight
          );
          
          if (imageData) {
            segmentationDataRef.current = imageData;
            if (detectionCount % LOG_INTERVAL_FRAMES === 0) {
              console.log('[Segmentation] ImageData updated in cache');
            }
          }
        }
        
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
        
        detectionCount++;
      } catch (error) {
        console.error('[Detection] Error:', error);
      } finally {
        isDetectingRef.current = false;
      }
    };

    detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, detect, segment, dispatch, videoElement, onShoulderAngleChange]);

  const clearCache = () => {
    detectionResultRef.current = null;
    segmentationDataRef.current = null;
    baselineAngleRef.current = null;
    prevSkeletonPartsRef.current = {
      face: null,
      body: null,
      hand: null,
    };
  };

  return {
    detectionResultRef,
    segmentationDataRef,
    prevSkeletonPartsRef,
    clearCache,
  };
};
