// Custom hook for canvas initialization and management

import { useEffect, useRef } from 'react';

export const useCanvasSetup = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const segmentationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmentationCtxRef = useRef<CanvasRenderingContext2D | null>(null);

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

    // Create temporary canvas for scaling segmentation
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

  return {
    canvasRef,
    offscreenCanvasRef,
    offscreenCtxRef,
    segmentationCanvasRef,
    segmentationCtxRef,
  };
};
