// Skeleton rendering utilities

import { HumanResult, CachedSkeletonParts } from '@/types/detection';
import { FACIAL_KEYPOINT_INDICES, BODY_CONNECTIONS, FINGER_CONNECTIONS } from './constants';
import { isFistClenched, calculateHandBoundingBox } from './fistDetection';

/**
 * Draw face detection as oval
 */
const drawFace = (
  ctx: CanvasRenderingContext2D,
  faceData: Array<{ box?: [number, number, number, number] }>,
  scaleX: number,
  scaleY: number
) => {
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
};

/**
 * Draw body pose skeleton with 3D data (BlazePose)
 */
const drawBody = (
  ctx: CanvasRenderingContext2D,
  bodyData: Array<{ keypoints?: any[] }>,
  scaleX: number,
  scaleY: number
) => {
  bodyData.forEach((body) => {
    const keypoints = body.keypoints;
    
    if (keypoints) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
      
      // Draw keypoints with size based on depth - SKIP FACIAL KEYPOINTS (0-10)
      keypoints.forEach((kp, index) => {
        // FILTER: Skip facial keypoints
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
      
      // Draw body connections
      BODY_CONNECTIONS.forEach(([i, j]) => {
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
};

/**
 * Draw hand poses with fist detection and bounding boxes
 */
const drawHands = (
  ctx: CanvasRenderingContext2D,
  handData: Array<{ keypoints?: Array<[number, number]> }>,
  scaleX: number,
  scaleY: number
) => {
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.lineWidth = 3;

  handData.forEach((hand) => {
    if (hand.keypoints) {
      // Check if this hand is a clenched fist
      const isFist = isFistClenched(hand.keypoints);
      
      // Draw hand keypoints
      hand.keypoints.forEach((kp) => {
        const scaledX = kp[0] * scaleX;
        const scaledY = kp[1] * scaleY;
        
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, 6, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw finger connections
      FINGER_CONNECTIONS.forEach(finger => {
        for (let i = 0; i < finger.length - 1; i++) {
          const kp1 = hand.keypoints![finger[i]];
          const kp2 = hand.keypoints![finger[i + 1]];
          if (kp1 && kp2) {
            ctx.beginPath();
            ctx.moveTo(kp1[0] * scaleX, kp1[1] * scaleY);
            ctx.lineTo(kp2[0] * scaleX, kp2[1] * scaleY);
            ctx.stroke();
          }
        }
      });

      // Draw bounding box if fist is detected
      if (isFist) {
        const bbox = calculateHandBoundingBox(hand.keypoints, 15);
        
        if (bbox) {
          const [minX, minY, maxX, maxY] = bbox;
          const scaledMinX = minX * scaleX;
          const scaledMinY = minY * scaleY;
          const scaledMaxX = maxX * scaleX;
          const scaledMaxY = maxY * scaleY;
          
          // Draw rectangular box around fist
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Red color for fist detection
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 5]); // Dashed line for visual distinction
          
          ctx.beginPath();
          ctx.rect(
            scaledMinX,
            scaledMinY,
            scaledMaxX - scaledMinX,
            scaledMaxY - scaledMinY
          );
          ctx.stroke();
          
          // Reset line dash for other drawings
          ctx.setLineDash([]);
          
          // Draw "FIST" label above the box
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.font = 'bold 16px Arial';
          ctx.fillText('FIST', scaledMinX, scaledMinY - 10);
          
          // Reset styles
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.lineWidth = 3;
        }
      }
    }
  });
};

/**
 * Main skeleton drawing function with persistence support
 */
export const drawSkeleton = (
  ctx: CanvasRenderingContext2D,
  result: HumanResult,
  cachedParts: CachedSkeletonParts,
  scaleX: number,
  scaleY: number
) => {
  // Use cached data if current detection is missing parts
  const faceData = result.face && result.face.length > 0 
    ? result.face 
    : cachedParts.face;
  
  const bodyData = result.body && result.body.length > 0 
    ? result.body 
    : cachedParts.body;
  
  const handData = result.hand && result.hand.length > 0 
    ? result.hand 
    : cachedParts.hand;
  
  // If ALL parts are missing, user is likely out of frame
  if (!faceData && !bodyData && !handData) {
    return;
  }

  // Draw each part
  if (faceData) drawFace(ctx, faceData, scaleX, scaleY);
  if (bodyData) drawBody(ctx, bodyData, scaleX, scaleY);
  if (handData) drawHands(ctx, handData, scaleX, scaleY);
};
