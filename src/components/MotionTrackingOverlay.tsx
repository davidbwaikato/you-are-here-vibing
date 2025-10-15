import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setPov } from '@/store/streetViewSlice';
import { RootState } from '@/store/store';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { Camera, CameraOff, Compass, RotateCw, Eye, EyeOff } from 'lucide-react';

interface BlazePoseKeypoint {
  distance: [number, number, number];  // 3D distance vector in meters relative to body center
  part: string;                         // Body part name (e.g., "nose", "leftShoulder", "rightShoulder")
  position: [number, number, number];   // Scaled pixel coordinates [x, y, z]
  positionRaw: [number, number, number]; // Normalized coordinates [x, y, z] (0-1 range)
  score: number;                        // Confidence score (0-1)
}

interface HumanResult {
  face?: Array<{
    box?: [number, number, number, number];
  }>;
  body?: Array<{
    keypoints?: BlazePoseKeypoint[];
  }>;
  hand?: Array<{
    keypoints?: Array<[number, number]>;
  }>;
}

// Cached skeleton parts for persistence (prevent flashing)
interface CachedSkeletonParts {
  face: Array<{ box?: [number, number, number, number] }> | null;
  body: Array<{ keypoints?: BlazePoseKeypoint[] }> | null;
  hand: Array<{ keypoints?: Array<[number, number]> }> | null;
}

// HYSTERESIS THRESHOLD: Minimum angle change required to update Street View heading
// This prevents jittery updates from small shoulder movements
const HysteresisHeadingAngleThreshold = 1.0; // degrees

// VIDEO OVERLAY ALPHA: Global alpha value for blending video with Street View
const VideoOverlayAlpha = 0.5; // 50% opacity for subtle blending

// FACIAL KEYPOINT INDICES: BlazePose includes facial landmarks in body keypoints (0-10)
// These should be filtered out to avoid redundant visualization with face detection
const FACIAL_KEYPOINT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Deep copy helper functions to prevent reference mutation
const deepCopyFace = (face: Array<{ box?: [number, number, number, number] }>): Array<{ box?: [number, number, number, number] }> => {
  return face.map(f => ({
    box: f.box ? [...f.box] as [number, number, number, number] : undefined
  }));
};

const deepCopyBody = (body: Array<{ keypoints?: BlazePoseKeypoint[] }>): Array<{ keypoints?: BlazePoseKeypoint[] }> => {
  return body.map(b => ({
    keypoints: b.keypoints?.map(kp => ({
      distance: [...kp.distance] as [number, number, number],
      part: kp.part,
      position: [...kp.position] as [number, number, number],
      positionRaw: [...kp.positionRaw] as [number, number, number],
      score: kp.score
    }))
  }));
};

const deepCopyHand = (hand: Array<{ keypoints?: Array<[number, number]> }>): Array<{ keypoints?: Array<[number, number]> }> => {
  return hand.map(h => ({
    keypoints: h.keypoints?.map(kp => [...kp] as [number, number])
  }));
};

export const MotionTrackingOverlay = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // SEGMENTATION SCALING: Temporary canvas for scaling segmentation to match skeleton
  const segmentationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmentationCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const animationFrameRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializingRef = useRef(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store latest detection result in a ref (doesn't cause re-renders)
  const detectionResultRef = useRef<HumanResult | null>(null);
  const segmentationDataRef = useRef<ImageData | null>(null);
  const isDetectingRef = useRef(false);
  
  // SKELETON PERSISTENCE: Cache last valid detection for each part (DEEP COPIED) - ALWAYS ON
  const prevSkeletonPartsRef = useRef<CachedSkeletonParts>({
    face: null,
    body: null,
    hand: null,
  });
  
  // Shoulder rotation tracking - ABSOLUTE MODEL
  const baselineAngleRef = useRef<number | null>(null);  // User's initial shoulder angle
  const baseHeadingRef = useRef<number>(355.84);         // Initial Street View heading from Trevi Fountain
  const lastDispatchedHeadingRef = useRef<number>(355.84); // Last heading value sent to Redux (for hysteresis)
  
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(true);
  const [shoulderAngle, setShoulderAngle] = useState<number | null>(null);
  
  const dispatch = useDispatch();
  const { pov } = useSelector((state: RootState) => state.streetView);
  const { detect, segment, isInitialized, error: humanError } = useHumanDetection(videoRef.current);

  // Calculate shoulder swivel angle from keypoints (Y-Z plane rotation)
  const calculateShoulderAngle = (keypoints: BlazePoseKeypoint[]): number | null => {
    // CRITICAL: BlazePose uses camelCase - "leftShoulder" and "rightShoulder"
    const leftShoulder = keypoints.find(kp => kp.part === 'leftShoulder');
    const rightShoulder = keypoints.find(kp => kp.part === 'rightShoulder');
    
    if (!leftShoulder || !rightShoulder) {
      return null;
    }
    
    // Check confidence scores
    if (leftShoulder.score < 0.5 || rightShoulder.score < 0.5) {
      return null;
    }
    
    // CORRECTED: Calculate swivel angle using Y-Z plane (horizontal rotation)
    const dx = rightShoulder.position[0] - leftShoulder.position[0];
    const dy = rightShoulder.position[1] - leftShoulder.position[1]; // horizontal difference
    const dz = rightShoulder.position[2] - leftShoulder.position[2]; // depth difference
    
    // atan2 returns angle in radians, convert to degrees
    const angleRad = Math.atan2(dz, dx);
    const angleDeg = angleRad * (180 / Math.PI);
    
    return angleDeg;
  };

  // Process segmentation tensor to ImageData
  const processTensorToImageData = async (tensor: any, width: number, height: number): Promise<ImageData | null> => {
    try {
      console.log('[Segmentation] Processing tensor:', {
        shape: tensor.shape,
        dtype: tensor.dtype,
        targetSize: `${width}x${height}`
      });

      // Get raw tensor data as Float32Array
      const rawData = await tensor.data();
      console.log('[Segmentation] Raw data length:', rawData.length);

      // Create Uint8ClampedArray for ImageData (RGBA format)
      const imageDataArray = new Uint8ClampedArray(width * height * 4);

      const numPixels = width * height;
      
      // Process tensor data: R, G, B, A values are consecutive in the array
      for (let i = 0; i < numPixels; i++) {
        const r = rawData[i * 4];
        const g = rawData[i * 4 + 1];
        const b = rawData[i * 4 + 2];
        const a = rawData[i * 4 + 3];

        imageDataArray[i * 4] = r;
        imageDataArray[i * 4 + 1] = g;
        imageDataArray[i * 4 + 2] = b;
        imageDataArray[i * 4 + 3] = a;
      }

      // Create ImageData from processed array
      const imageData = new ImageData(imageDataArray, width, height);
      console.log('[Segmentation] ImageData created:', {
        width: imageData.width,
        height: imageData.height,
        dataLength: imageData.data.length
      });

      return imageData;
    } catch (err) {
      console.error('[Segmentation] Tensor processing error:', err);
      return null;
    }
  };

  // Initialize webcam
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

  // Initialize offscreen canvas for double-buffering
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('[DoubleBuffer] Creating offscreen canvas...');
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasRef.current.width;
    offscreenCanvas.height = canvasRef.current.height;
    
    const offscreenCtx = offscreenCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    });

    if (offscreenCtx) {
      offscreenCanvasRef.current = offscreenCanvas;
      offscreenCtxRef.current = offscreenCtx;
      console.log('[DoubleBuffer] Offscreen canvas created');
    } else {
      console.error('[DoubleBuffer] Failed to create offscreen context');
    }

    // SEGMENTATION SCALING: Create temporary canvas for scaling segmentation
    console.log('[SegmentationScale] Creating segmentation scaling canvas...');
    const segCanvas = document.createElement('canvas');
    const segCtx = segCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    });

    if (segCtx) {
      segmentationCanvasRef.current = segCanvas;
      segmentationCtxRef.current = segCtx;
      console.log('[SegmentationScale] Segmentation canvas created');
    } else {
      console.error('[SegmentationScale] Failed to create segmentation context');
    }

    return () => {
      console.log('[DoubleBuffer] Cleaning up offscreen canvas');
      offscreenCanvasRef.current = null;
      offscreenCtxRef.current = null;
      segmentationCanvasRef.current = null;
      segmentationCtxRef.current = null;
    };
  }, []);

  // SEPARATE DETECTION LOOP - Runs independently at ~20fps when enabled
  useEffect(() => {
    if (!isInitialized || !isCameraActive || !isTrackingEnabled) {
      // Clear detection interval if tracking is disabled
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        console.log('[Detection] Loop stopped - tracking disabled');
      }
      
      return;
    }

    console.log('[Detection] Starting detection loop with segmentation...');
    console.log('[Cache] Skeleton cache: ALWAYS ON');
    console.log('[VideoOverlay] Video overlay: ALWAYS ON (with segmentation)');
    console.log('[Hysteresis] Threshold set to:', HysteresisHeadingAngleThreshold, '°');
    let detectionCount = 0;

    const runDetection = async () => {
      if (isDetectingRef.current) {
        return;
      }

      isDetectingRef.current = true;
      
      try {
        // Run detection and segmentation in parallel
        const [result, segmentationTensor] = await Promise.all([
          detect(),
          segment()
        ]);

        // Process segmentation tensor to ImageData
        if (segmentationTensor && videoRef.current) {
          const imageData = await processTensorToImageData(
            segmentationTensor,
            videoRef.current.videoWidth,
            videoRef.current.videoHeight
          );
          
          if (imageData) {
            segmentationDataRef.current = imageData;
            if (detectionCount % 30 === 0) {
              console.log('[Segmentation] ImageData updated in cache');
            }
          }
        }
        
        // SKELETON PERSISTENCE: DEEP COPY each part that was detected (ALWAYS ON)
        if (result?.face && result.face.length > 0) {
          prevSkeletonPartsRef.current.face = deepCopyFace(result.face);
          if (detectionCount % 30 === 0) {
            console.log('[DeepCopy] Face data copied to cache');
          }
        }
        if (result?.body && result.body.length > 0) {
          prevSkeletonPartsRef.current.body = deepCopyBody(result.body);
          if (detectionCount % 30 === 0) {
            console.log('[DeepCopy] Body data copied to cache');
          }
        }
        if (result?.hand && result.hand.length > 0) {
          prevSkeletonPartsRef.current.hand = deepCopyHand(result.hand);
          if (detectionCount % 30 === 0) {
            console.log('[DeepCopy] Hand data copied to cache');
          }
        }
        
        // Store result in ref for rendering loop to use
        detectionResultRef.current = result as HumanResult;
        
        // Calculate shoulder swivel and update Street View heading - ABSOLUTE MODEL
        if (result?.body?.[0]?.keypoints) {
          const currentAngle = calculateShoulderAngle(result.body[0].keypoints);
          
          if (currentAngle !== null) {
            // Set baseline on first valid detection
            if (baselineAngleRef.current === null) {
              baselineAngleRef.current = currentAngle;
              console.log('[Shoulder] ✓ Baseline swivel angle set:', currentAngle.toFixed(2), '°');
            }
            
            // ABSOLUTE CALCULATION: Calculate angle difference from baseline
            const angleDelta = currentAngle - baselineAngleRef.current;
            
            // Update shoulder angle state for UI display
            setShoulderAngle(angleDelta);
            
            // ABSOLUTE MODEL: heading = baseHeading - angleDelta
            const newHeading = baseHeadingRef.current - angleDelta;
            
            // Normalize heading to 0-360 range
            const normalizedHeading = ((newHeading % 360) + 360) % 360;
            
            // HYSTERESIS CHECK: Only dispatch if change exceeds threshold
            const headingDelta = Math.abs(normalizedHeading - lastDispatchedHeadingRef.current);
            const wrappedDelta = Math.min(headingDelta, 360 - headingDelta);
            
            if (wrappedDelta >= HysteresisHeadingAngleThreshold) {
              dispatch(setPov({
                heading: normalizedHeading,
                pitch: -1.84,
              }));
              
              lastDispatchedHeadingRef.current = normalizedHeading;
              
              if (detectionCount % 10 === 0) {
                console.log('[Hysteresis] ✓ Heading updated:', {
                  userSwivel: angleDelta.toFixed(2) + '°',
                  newHeading: normalizedHeading.toFixed(2) + '°',
                  delta: wrappedDelta.toFixed(2) + '°',
                  status: 'DISPATCHED'
                });
              }
            }
          } else {
            setShoulderAngle(null);
          }
        } else {
          setShoulderAngle(null);
        }
        
        detectionCount++;
        if (detectionCount % 30 === 0) {
          console.log('[Persistence] Cache status:', {
            hasFace: !!prevSkeletonPartsRef.current.face,
            hasBody: !!prevSkeletonPartsRef.current.body,
            hasHand: !!prevSkeletonPartsRef.current.hand,
            hasSegmentation: !!segmentationDataRef.current,
            currentDetection: {
              face: !!result?.face?.length,
              body: !!result?.body?.length,
              hand: !!result?.hand?.length,
            }
          });
        }
      } catch (error) {
        console.error('[Detection] Error:', error);
      } finally {
        isDetectingRef.current = false;
      }
    };

    // Run detection every 50ms (~20fps)
    detectionIntervalRef.current = setInterval(runDetection, 50);

    return () => {
      console.log('[Detection] Stopping detection loop');
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, detect, segment, dispatch]);

  // Drawing functions with skeleton persistence
  const drawSkeleton = (ctx: CanvasRenderingContext2D, result: HumanResult, scaleX: number, scaleY: number) => {
    // SKELETON PERSISTENCE: Use cached data if current detection is missing parts (ALWAYS ON)
    const faceData = result.face && result.face.length > 0 
      ? result.face 
      : prevSkeletonPartsRef.current.face;
    
    const bodyData = result.body && result.body.length > 0 
      ? result.body 
      : prevSkeletonPartsRef.current.body;
    
    const handData = result.hand && result.hand.length > 0 
      ? result.hand 
      : prevSkeletonPartsRef.current.hand;
    
    // CRITICAL: If ALL parts are missing, user is likely out of frame - don't draw anything
    if (!faceData && !bodyData && !handData) {
      return;
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';

    // Draw face detection as oval
    if (faceData) {
      faceData.forEach((face) => {
        if (face.box) {
          const [x, y, w, h] = face.box;
          const scaledX = x * scaleX;
          const scaledY = y * scaleY;
          const scaledW = w * scaleX;
          const scaledH = h * scaleY;
          
          const centerX = scaledX + scaledW / 2;
          const centerY = scaledY + scaledH / 2;
          const radiusX = scaledW / 2;
          const radiusY = scaledH / 2;
          
          ctx.strokeStyle = 'rgba(147, 51, 234, 0.9)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
          
          ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // Draw body pose skeleton with 3D data (BlazePose) - FILTER OUT FACIAL KEYPOINTS
    if (bodyData) {
      bodyData.forEach((body) => {
        const keypoints = body.keypoints;
        
        if (keypoints) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
          
          // Draw keypoints with size based on depth - SKIP FACIAL KEYPOINTS (0-10)
          keypoints.forEach((kp, index) => {
            // FILTER: Skip facial keypoints (indices 0-10)
            if (FACIAL_KEYPOINT_INDICES.includes(index)) {
              return;
            }
            
            if (kp.score && kp.score > 0.3 && kp.position) {
              const scaledX = kp.position[0] * scaleX;
              const scaledY = kp.position[1] * scaleY;
              const depth = kp.position[2];
              
              const depthFactor = depth !== undefined ? (1 - (depth / 200)) : 1;
              const pointSize = Math.max(4, Math.min(12, 8 * Math.max(0.5, Math.min(1.5, depthFactor))));
              
              ctx.beginPath();
              ctx.arc(scaledX, scaledY, pointSize, 0, 2 * Math.PI);
              ctx.fill();
              
              // Highlight shoulders in amber
              if (kp.part === 'leftShoulder' || kp.part === 'rightShoulder') {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
                ctx.beginPath();
                ctx.arc(scaledX, scaledY, pointSize + 2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
              }
            }
          });

          ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
          ctx.lineWidth = 4;
          
          // BlazePose connections (33 keypoints) - FILTER OUT FACIAL CONNECTIONS
          const connections = [
            // Body connections only (skip facial connections involving indices 0-10)
            [11, 12], [11, 23], [12, 24], [23, 24],
            [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
            [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
            [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
            [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
            // REMOVED: Facial connections [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10]
          ];

          connections.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1?.score && kp2?.score && kp1.score > 0.3 && kp2.score > 0.3 && kp1.position && kp2.position) {
              // Highlight shoulder line in amber
              if ((i === 11 && j === 12) || (i === 12 && j === 11)) {
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
                ctx.lineWidth = 6;
              }
              
              ctx.beginPath();
              ctx.moveTo(kp1.position[0] * scaleX, kp1.position[1] * scaleY);
              ctx.lineTo(kp2.position[0] * scaleX, kp2.position[1] * scaleY);
              ctx.stroke();
              
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
              ctx.lineWidth = 4;
            }
          });
        }
      });
    }

    // Draw hand poses
    if (handData) {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.lineWidth = 3;

      handData.forEach((hand) => {
        if (hand.keypoints) {
          hand.keypoints.forEach((kp) => {
            const scaledX = kp[0] * scaleX;
            const scaledY = kp[1] * scaleY;
            
            ctx.beginPath();
            ctx.arc(scaledX, scaledY, 6, 0, 2 * Math.PI);
            ctx.fill();
          });

          const fingerConnections = [
            [0, 1, 2, 3, 4],
            [0, 5, 6, 7, 8],
            [0, 9, 10, 11, 12],
            [0, 13, 14, 15, 16],
            [0, 17, 18, 19, 20],
          ];

          fingerConnections.forEach(finger => {
            for (let i = 0; i < finger.length - 1; i++) {
              const kp1 = hand.keypoints[finger[i]];
              const kp2 = hand.keypoints[finger[i + 1]];
              if (kp1 && kp2) {
                ctx.beginPath();
                ctx.moveTo(kp1[0] * scaleX, kp1[1] * scaleY);
                ctx.lineTo(kp2[0] * scaleX, kp2[1] * scaleY);
                ctx.stroke();
              }
            }
          });
        }
      });
    }
  };

  // RENDER LOOP - Runs at 60fps with double-buffering
  useEffect(() => {
    if (!isInitialized || !isCameraActive) {
      return;
    }

    console.log('[Render] Starting render loop with segmentation...');
    console.log('[Skeleton] Visibility:', isSkeletonVisible ? 'VISIBLE' : 'HIDDEN');
    let frameCount = 0;

    const render = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const offscreenCanvas = offscreenCanvasRef.current;
      const offscreenCtx = offscreenCtxRef.current;
      const segCanvas = segmentationCanvasRef.current;
      const segCtx = segmentationCtxRef.current;

      if (!canvas || !video || video.readyState < 2 || !offscreenCanvas || !offscreenCtx || !segCanvas || !segCtx) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[Render] Failed to get canvas context');
        return;
      }

      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      // Clear offscreen canvas
      offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      // VIDEO OVERLAY WITH SEGMENTATION: Draw segmented person (ALWAYS ON)
      const segmentationData = segmentationDataRef.current;
      if (segmentationData) {
        // SEGMENTATION SCALING: Resize segmentation canvas to match video dimensions
        if (segCanvas.width !== video.videoWidth || segCanvas.height !== video.videoHeight) {
          segCanvas.width = video.videoWidth;
          segCanvas.height = video.videoHeight;
          if (frameCount % 120 === 0) {
            console.log('[SegmentationScale] Canvas resized to:', `${segCanvas.width}x${segCanvas.height}`);
          }
        }

        // Put ImageData at native resolution on segmentation canvas
        segCtx.putImageData(segmentationData, 0, 0);

        // Now draw scaled segmentation to offscreen canvas with mirror effect
        offscreenCtx.save();
        
        // Apply mirror effect for video (same as skeleton)
        offscreenCtx.scale(-1, 1);
        offscreenCtx.translate(-offscreenCanvas.width, 0);
        
        // Set global alpha for blending
        offscreenCtx.globalAlpha = VideoOverlayAlpha;
        
        // CRITICAL: Draw segmentation canvas scaled to match canvas dimensions (same as skeleton)
        offscreenCtx.drawImage(
          segCanvas,
          0, 0, video.videoWidth, video.videoHeight,  // Source: native video resolution
          0, 0, canvas.width, canvas.height            // Destination: scaled to canvas (same as skeleton)
        );
        
        // Reset global alpha for skeleton drawing
        offscreenCtx.globalAlpha = 1.0;
        
        offscreenCtx.restore();
        
        if (frameCount % 120 === 0) {
          console.log('[VideoOverlay] Rendering scaled segmentation:', {
            sourceSize: `${video.videoWidth}x${video.videoHeight}`,
            destSize: `${canvas.width}x${canvas.height}`,
            scaleX: scaleX.toFixed(3),
            scaleY: scaleY.toFixed(3),
            opacity: (VideoOverlayAlpha * 100).toFixed(0) + '%'
          });
        }
      }

      // SKELETON OVERLAY: Draw skeleton on top of video (if tracking AND visibility enabled)
      if (isTrackingEnabled && isSkeletonVisible) {
        offscreenCtx.save();
        offscreenCtx.scale(-1, 1);
        offscreenCtx.translate(-offscreenCanvas.width, 0);

        const result = detectionResultRef.current;
        if (result) {
          drawSkeleton(offscreenCtx, result, scaleX, scaleY);
        }

        offscreenCtx.restore();

        if (frameCount % 120 === 0) {
          console.log('[Render] Frame:', {
            count: frameCount,
            skeletonVisible: isSkeletonVisible,
            hasSegmentation: !!segmentationData,
            usingCache: {
              face: !result?.face?.length && !!prevSkeletonPartsRef.current.face,
              body: !result?.body?.length && !!prevSkeletonPartsRef.current.body,
              hand: !result?.hand?.length && !!prevSkeletonPartsRef.current.hand,
            }
          });
        }
      }

      // Copy offscreen canvas to visible canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 0, 0);

      frameCount++;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, isCameraActive, isTrackingEnabled, isSkeletonVisible]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        canvasRef.current.width = newWidth;
        canvasRef.current.height = newHeight;
        
        if (offscreenCanvasRef.current) {
          offscreenCanvasRef.current.width = newWidth;
          offscreenCanvasRef.current.height = newHeight;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTracking = () => {
    setIsTrackingEnabled(prev => {
      const newState = !prev;
      console.log('[Tracking] Toggle:', newState ? 'ON' : 'OFF');
      
      if (!newState) {
        detectionResultRef.current = null;
        segmentationDataRef.current = null;
        baselineAngleRef.current = null;
        setShoulderAngle(null);
        // Clear skeleton cache when tracking disabled
        prevSkeletonPartsRef.current = {
          face: null,
          body: null,
          hand: null,
        };
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

      {/* Tracking Status Button */}
      <button
        onClick={toggleTracking}
        className="fixed top-4 right-4 z-50 w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
      >
        {cameraError || humanError ? (
          <>
            <CameraOff className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">Camera Error</span>
          </>
        ) : isCameraActive && isInitialized ? (
          isTrackingEnabled ? (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
              <Camera className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-xs text-green-400">Tracking Active</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
              <CameraOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Tracking Paused</span>
            </>
          )
        ) : (
          <>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs text-yellow-400">Initializing...</span>
          </>
        )}
      </button>

      {/* Skeleton Visibility Toggle Button */}
      <button
        onClick={toggleSkeletonVisibility}
        className="fixed top-16 right-4 z-50 w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
      >
        {isSkeletonVisible ? (
          <>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0" />
            <Eye className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-indigo-400">Skeleton Visible</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
            <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400">Skeleton Hidden</span>
          </>
        )}
      </button>

      {/* POV Heading Display */}
      <div className="fixed top-28 right-4 z-50 w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-none">
        <Compass className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-xs text-blue-400 font-mono">
          Heading: {pov.heading.toFixed(1)}°
        </span>
      </div>

      {/* Shoulder Rotation Display */}
      <div className="fixed top-40 right-4 z-50 w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-none">
        <RotateCw className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-amber-400 font-mono">
          Swivel: {shoulderAngle !== null ? `${shoulderAngle.toFixed(1)}°` : '--'}
        </span>
      </div>
    </>
  );
};
