import { useEffect, useRef, MutableRefObject } from 'react';
import { HumanResult, CachedSkeletonParts } from '@/types/detection';
import { isFistClenched, calculateHandBoundingBox, classifyHandGesture, GestureBuffer } from '@/utils/fistDetection';
import { calculateShoulderAngle } from '@/utils/shoulderTracking';

interface UseDetectionLoopProps {
  isInitialized: boolean;
  isCameraActive: boolean;
  isTrackingEnabled: boolean;
  videoElement: HTMLVideoElement | null;
  detect: (video: HTMLVideoElement) => Promise<any>;
  onShoulderAngleChange: (angle: number | null) => void;
  canvasElement: HTMLCanvasElement | null;
}

interface UseDetectionLoopReturn {
  detectionResultRef: MutableRefObject<HumanResult | null>;
  prevSkeletonPartsRef: MutableRefObject<CachedSkeletonParts>;
  detectionFps: number;
  clearCache: () => void;
}

export const useDetectionLoop = ({
  isInitialized,
  isCameraActive,
  isTrackingEnabled,
  videoElement,
  detect,
  onShoulderAngleChange,
  canvasElement,
}: UseDetectionLoopProps): UseDetectionLoopReturn => {
  const detectionResultRef = useRef<HumanResult | null>(null);
  const prevSkeletonPartsRef = useRef<CachedSkeletonParts>({
    face: null,
    body: null,
    hand: null,
  });

  // Gesture buffers for temporal smoothing
  const leftHandGestureBufferRef = useRef<GestureBuffer>(new GestureBuffer(5, 3));
  const rightHandGestureBufferRef = useRef<GestureBuffer>(new GestureBuffer(5, 3));

  // FPS tracking
  const detectionFpsRef = useRef<number>(0);
  const detectionFrameCountRef = useRef<number>(0);
  const detectionLastFpsUpdateRef = useRef<number>(Date.now());

  const clearCache = () => {
    console.log('[Detection Loop] Clearing detection cache and gesture buffers');
    detectionResultRef.current = null;
    prevSkeletonPartsRef.current = {
      face: null,
      body: null,
      hand: null,
    };
    
    // Reset gesture buffers
    leftHandGestureBufferRef.current.reset();
    rightHandGestureBufferRef.current.reset();
    
    onShoulderAngleChange(null);
  };

  useEffect(() => {
    if (!isInitialized || !isCameraActive || !isTrackingEnabled || !videoElement || !canvasElement) {
      return;
    }

    console.log('[Detection Loop] Starting detection loop...');
    let isRunning = true;
    let animationFrameId: number;

    const runDetection = async () => {
      if (!isRunning) return;

      try {
        const result = await detect(videoElement);

        if (!isRunning) return;

        // Update FPS counter
        detectionFrameCountRef.current++;
        const now = Date.now();
        const elapsed = now - detectionLastFpsUpdateRef.current;
        if (elapsed >= 1000) {
          detectionFpsRef.current = Math.round((detectionFrameCountRef.current * 1000) / elapsed);
          detectionFrameCountRef.current = 0;
          detectionLastFpsUpdateRef.current = now;
        }

        // Process hand detection with gesture recognition
        const leftHandData = result.hand?.[0];
        const rightHandData = result.hand?.[1];

        // LEFT HAND PROCESSING
        let leftHandDetectionData = {
          detected: false,
          boundingBox: null,
          isFist: false,
          gesture: 'relaxed' as const,
        };

        if (leftHandData?.keypoints) {
          const boundingBox = calculateHandBoundingBox(leftHandData.keypoints);
          const isFist = isFistClenched(leftHandData.keypoints);
          
          // Classify raw gesture
          const rawGesture = classifyHandGesture(leftHandData.keypoints);
          
          // Apply temporal smoothing
          const confirmedGesture = leftHandGestureBufferRef.current.addSample(rawGesture);

          leftHandDetectionData = {
            detected: true,
            boundingBox,
            isFist, // Keep for backward compatibility
            gesture: confirmedGesture,
          };
        } else {
          // No hand detected - add 'relaxed' sample to buffer
          leftHandGestureBufferRef.current.addSample('relaxed');
          leftHandDetectionData.gesture = leftHandGestureBufferRef.current.getCurrentGesture();
        }

        // RIGHT HAND PROCESSING
        let rightHandDetectionData = {
          detected: false,
          boundingBox: null,
          isFist: false,
          gesture: 'relaxed' as const,
        };

        if (rightHandData?.keypoints) {
          const boundingBox = calculateHandBoundingBox(rightHandData.keypoints);
          const isFist = isFistClenched(rightHandData.keypoints);
          
          // Classify raw gesture
          const rawGesture = classifyHandGesture(rightHandData.keypoints);
          
          // Apply temporal smoothing
          const confirmedGesture = rightHandGestureBufferRef.current.addSample(rawGesture);

          rightHandDetectionData = {
            detected: true,
            boundingBox,
            isFist, // Keep for backward compatibility
            gesture: confirmedGesture,
          };
        } else {
          // No hand detected - add 'relaxed' sample to buffer
          rightHandGestureBufferRef.current.addSample('relaxed');
          rightHandDetectionData.gesture = rightHandGestureBufferRef.current.getCurrentGesture();
        }

        // Store enhanced result
        detectionResultRef.current = {
          ...result,
          leftHand: leftHandDetectionData,
          rightHand: rightHandDetectionData,
        };

        // Cache skeleton parts for rendering
        prevSkeletonPartsRef.current = {
          face: result.face || null,
          body: result.body || null,
          hand: result.hand || null,
        };

        // CRITICAL: Calculate shoulder angle using proper utility function
        if (result.body?.[0]?.keypoints) {
          const keypoints = result.body[0].keypoints;
          const shoulderAngle = calculateShoulderAngle(keypoints);
          
          if (shoulderAngle !== null) {
            console.log('[Detection Loop] 🔄 Shoulder angle calculated:', shoulderAngle.toFixed(2), '°');
            onShoulderAngleChange(shoulderAngle);
          } else {
            console.log('[Detection Loop] ⚠️ Shoulder angle calculation failed (low confidence or missing keypoints)');
            onShoulderAngleChange(null);
          }
        } else {
          console.log('[Detection Loop] ⚠️ No body keypoints detected');
          onShoulderAngleChange(null);
        }
      } catch (error) {
        console.error('[Detection Loop] Detection error:', error);
      }

      if (isRunning) {
        animationFrameId = requestAnimationFrame(runDetection);
      }
    };

    runDetection();

    return () => {
      console.log('[Detection Loop] Stopping detection loop');
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, videoElement, detect, onShoulderAngleChange, canvasElement]);

  return {
    detectionResultRef,
    prevSkeletonPartsRef,
    detectionFps: detectionFpsRef.current,
    clearCache,
  };
};
