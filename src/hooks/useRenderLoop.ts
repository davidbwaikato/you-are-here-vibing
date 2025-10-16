// Custom hook for render loop management

import { useEffect, useRef, useState } from 'react';
import { drawSkeleton } from '@/utils/skeletonRenderer';
import { HumanResult, CachedSkeletonParts } from '@/types/detection';
import { VIDEO_OVERLAY_ALPHA, RENDER_LOG_INTERVAL_FRAMES } from '@/utils/constants';

interface UseRenderLoopProps {
  isInitialized: boolean;
  isCameraActive: boolean;
  isTrackingEnabled: boolean;
  isSkeletonVisible: boolean;
  videoElement: HTMLVideoElement | null;
  canvasElement: HTMLCanvasElement | null;
  offscreenCanvas: HTMLCanvasElement | null;
  offscreenCtx: CanvasRenderingContext2D | null;
  segmentationCanvas: HTMLCanvasElement | null;
  segmentationCtx: CanvasRenderingContext2D | null;
  detectionResult: React.MutableRefObject<HumanResult | null>;
  segmentationData: React.MutableRefObject<ImageData | null>;
  cachedParts: React.MutableRefObject<CachedSkeletonParts>;
}

export const useRenderLoop = ({
  isInitialized,
  isCameraActive,
  isTrackingEnabled,
  isSkeletonVisible,
  videoElement,
  canvasElement,
  offscreenCanvas,
  offscreenCtx,
  segmentationCanvas,
  segmentationCtx,
  detectionResult,
  segmentationData,
  cachedParts,
}: UseRenderLoopProps) => {
  const animationFrameRef = useRef<number>();
  
  // FPS calculation state
  const [renderFps, setRenderFps] = useState<number>(0);
  const lastRenderTimeRef = useRef<number>(performance.now());
  const renderFrameTimesRef = useRef<number[]>([]);
  const FPS_SAMPLE_SIZE = 30; // Average over last 30 frames for smoother rendering FPS

  useEffect(() => {
    if (!isInitialized || !isCameraActive) {
      setRenderFps(0);
      renderFrameTimesRef.current = [];
      return;
    }

    console.log('[Render] Starting render loop with segmentation...');
    let frameCount = 0;

    const render = () => {
      if (!canvasElement || !videoElement || videoElement.readyState < 2 || 
          !offscreenCanvas || !offscreenCtx || !segmentationCanvas || !segmentationCtx) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Calculate FPS
      const currentTime = performance.now();
      const deltaTime = currentTime - lastRenderTimeRef.current;
      lastRenderTimeRef.current = currentTime;
      
      renderFrameTimesRef.current.push(deltaTime);
      if (renderFrameTimesRef.current.length > FPS_SAMPLE_SIZE) {
        renderFrameTimesRef.current.shift();
      }
      
      const avgDeltaTime = renderFrameTimesRef.current.reduce((a, b) => a + b, 0) / renderFrameTimesRef.current.length;
      const fps = 1000 / avgDeltaTime;
      setRenderFps(fps);

      const ctx = canvasElement.getContext('2d');
      if (!ctx) {
        console.error('[Render] Failed to get canvas context');
        return;
      }

      const scaleX = canvasElement.width / videoElement.videoWidth;
      const scaleY = canvasElement.height / videoElement.videoHeight;

      // Clear offscreen canvas
      offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      // Draw segmented video overlay
      const segData = segmentationData.current;
      if (segData) {
        // Resize segmentation canvas if needed
        if (segmentationCanvas.width !== videoElement.videoWidth || 
            segmentationCanvas.height !== videoElement.videoHeight) {
          segmentationCanvas.width = videoElement.videoWidth;
          segmentationCanvas.height = videoElement.videoHeight;
        }

        // Put ImageData at native resolution
        segmentationCtx.putImageData(segData, 0, 0);

        // Draw scaled with mirror effect
        offscreenCtx.save();
        offscreenCtx.scale(-1, 1);
        offscreenCtx.translate(-offscreenCanvas.width, 0);
        offscreenCtx.globalAlpha = VIDEO_OVERLAY_ALPHA;
        
        offscreenCtx.drawImage(
          segmentationCanvas,
          0, 0, videoElement.videoWidth, videoElement.videoHeight,
          0, 0, canvasElement.width, canvasElement.height
        );
        
        offscreenCtx.globalAlpha = 1.0;
        offscreenCtx.restore();
      }

      // Draw skeleton overlay
      if (isTrackingEnabled && isSkeletonVisible) {
        offscreenCtx.save();
        offscreenCtx.scale(-1, 1);
        offscreenCtx.translate(-offscreenCanvas.width, 0);

        const result = detectionResult.current;
        if (result) {
          drawSkeleton(offscreenCtx, result, cachedParts.current, scaleX, scaleY);
        }

        offscreenCtx.restore();

        if (frameCount % RENDER_LOG_INTERVAL_FRAMES === 0) {
          console.log('[Render] Frame:', {
            count: frameCount,
            skeletonVisible: isSkeletonVisible,
            hasSegmentation: !!segData,
          });
        }
      }

      // Copy offscreen canvas to visible canvas
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
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
  }, [
    isInitialized,
    isCameraActive,
    isTrackingEnabled,
    isSkeletonVisible,
    videoElement,
    canvasElement,
    offscreenCanvas,
    offscreenCtx,
    segmentationCanvas,
    segmentationCtx,
    detectionResult,
    segmentationData,
    cachedParts,
  ]);

  return { renderFps };
};
