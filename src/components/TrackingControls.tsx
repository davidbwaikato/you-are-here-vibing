import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Activity, Eye, EyeOff, Video, VideoOff, AlertTriangle } from 'lucide-react';

interface TrackingControlsProps {
  cameraError: string | null;
  humanError: string | null;
  isCameraActive: boolean;
  isInitialized: boolean;
  isTrackingEnabled: boolean;
  isSkeletonVisible: boolean;
  isVideoOverlayEnabled: boolean;
  shoulderAngle: number | null;
  heading: number;
  detectionFps: number;
  segmentationFps: number;
  webglContextLost: boolean;
  isInitializingModels: boolean;
  isAccessingCamera: boolean;
  isReleasingCamera: boolean;
  onToggleTracking: () => void;
  onToggleSkeletonVisibility: () => void;
  onToggleVideoOverlay: () => void;
}

export const TrackingControls = ({
  cameraError,
  humanError,
  isCameraActive,
  isInitialized,
  isTrackingEnabled,
  isSkeletonVisible,
  isVideoOverlayEnabled,
  shoulderAngle,
  heading,
  detectionFps,
  segmentationFps,
  webglContextLost,
  isInitializingModels,
  isAccessingCamera,
  isReleasingCamera,
  onToggleTracking,
  onToggleSkeletonVisibility,
  onToggleVideoOverlay,
}: TrackingControlsProps) => {
  // Refs to track maximum widths
  const povHeadingRef = useRef<HTMLDivElement>(null);
  const shoulderRotationRef = useRef<HTMLDivElement>(null);
  const trackingButtonRef = useRef<HTMLButtonElement>(null);
  const skeletonButtonRef = useRef<HTMLButtonElement>(null);
  const overlayButtonRef = useRef<HTMLButtonElement>(null);
  
  const maxPovWidthRef = useRef<number>(0);
  const maxShoulderWidthRef = useRef<number>(0);
  const maxTrackingWidthRef = useRef<number>(0);
  const maxSkeletonWidthRef = useRef<number>(0);
  const maxOverlayWidthRef = useRef<number>(0);

  // Update maximum widths when content changes
  useEffect(() => {
    if (povHeadingRef.current) {
      const width = povHeadingRef.current.offsetWidth;
      if (width > maxPovWidthRef.current) {
        maxPovWidthRef.current = width;
        povHeadingRef.current.style.minWidth = `${width}px`;
      }
    }
  }, [heading]);

  useEffect(() => {
    if (shoulderRotationRef.current) {
      const width = shoulderRotationRef.current.offsetWidth;
      if (width > maxShoulderWidthRef.current) {
        maxShoulderWidthRef.current = width;
        shoulderRotationRef.current.style.minWidth = `${width}px`;
      }
    }
  }, [shoulderAngle]);

  useEffect(() => {
    if (trackingButtonRef.current) {
      const width = trackingButtonRef.current.offsetWidth;
      if (width > maxTrackingWidthRef.current) {
        maxTrackingWidthRef.current = width;
        trackingButtonRef.current.style.minWidth = `${width}px`;
      }
    }
  }, [isTrackingEnabled, isInitializingModels, isAccessingCamera, isReleasingCamera, webglContextLost]);

  useEffect(() => {
    if (skeletonButtonRef.current) {
      const width = skeletonButtonRef.current.offsetWidth;
      if (width > maxSkeletonWidthRef.current) {
        maxSkeletonWidthRef.current = width;
        skeletonButtonRef.current.style.minWidth = `${width}px`;
      }
    }
  }, [isSkeletonVisible, detectionFps]);

  useEffect(() => {
    if (overlayButtonRef.current) {
      const width = overlayButtonRef.current.offsetWidth;
      if (width > maxOverlayWidthRef.current) {
        maxOverlayWidthRef.current = width;
        overlayButtonRef.current.style.minWidth = `${width}px`;
      }
    }
  }, [isVideoOverlayEnabled, segmentationFps]);

  const formatAngle = (angle: number) => {
    return angle.toFixed(1);
  };

  const formatAngleClockWisePos = (angle: number) => {
    const neg_angle = -1 * angle;

    const formatter = new Intl.NumberFormat(undefined, {
        signDisplay: 'always'
    });
    return formatter.format(neg_angle.toFixed(1));		
  };

  const formatFps = (fps: number) => {
    return fps.toFixed(1);
  };

  const getTrackingButtonText = () => {
    if (isInitializingModels) {
      return 'Loading Models...';
    }
    if (isAccessingCamera) {
      return 'Accessing Camera...';
    }
    if (isReleasingCamera) {
      return 'Releasing Camera...';
    }
    return isTrackingEnabled ? 'Tracking Active' : 'Tracking Paused';
  };

  const getSkeletonButtonText = () => {
    const baseText = isSkeletonVisible ? 'Hide Skeleton' : 'Show Skeleton';
    if (detectionFps > 0) {
      return `${baseText}: ${formatFps(detectionFps)}/sec`;
    }
    return baseText;
  };

  const getOverlayButtonText = () => {
    const baseText = isVideoOverlayEnabled ? 'Overlay On' : 'Overlay Off';
    if (segmentationFps > 0) {
      return `${baseText}: ${formatFps(segmentationFps)}/sec`;
    }
    return baseText;
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-50 pointer-events-none">
      <div className="flex justify-between items-start gap-4">
        {/* Left side - Information displays */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Error Messages */}
          {cameraError && (
            <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg">
              Camera Error: {cameraError}
            </div>
          )}
          
          {humanError && (
            <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg">
              Detection Error: {humanError}
            </div>
          )}

          {/* WebGL Context Lost Warning */}
          {webglContextLost && (
            <div className="bg-orange-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>WebGL Context Lost - Restoring...</span>
            </div>
          )}

          {/* POV Heading Display */}
          {isCameraActive && isInitialized && (
            <div 
              ref={povHeadingRef}
              className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg"
            >
              <div className="text-sm font-medium">
                POV Heading: {formatAngle(heading)}°
              </div>
            </div>
          )}

          {/* Shoulder Rotation Display - Always visible when camera active and initialized */}
          {isCameraActive && isInitialized && (
            <div 
              ref={shoulderRotationRef}
              className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg"
            >
              <div className="text-sm font-medium">
                Shoulder Rotation: {shoulderAngle !== null ? `${formatAngleClockWisePos(shoulderAngle)}°` : '--'}
              </div>
            </div>
          )}
        </div>

        {/* Right side - Toggle controls */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Tracking Status Button */}
          <Button
            ref={trackingButtonRef}
            onClick={onToggleTracking}
            variant={isTrackingEnabled ? "default" : "secondary"}
            className="justify-start"
            disabled={webglContextLost || isInitializingModels || isAccessingCamera || isReleasingCamera}
          >
            <Activity className="w-4 h-4 mr-2" />
            {getTrackingButtonText()}
          </Button>

          {/* Skeleton Visibility Button */}
          <Button
            ref={skeletonButtonRef}
            onClick={onToggleSkeletonVisibility}
            variant={isSkeletonVisible ? "default" : "secondary"}
            className="justify-start"
            disabled={!isCameraActive || !isInitialized}
          >
            {isSkeletonVisible ? (
              <Eye className="w-4 h-4 mr-2" />
            ) : (
              <EyeOff className="w-4 h-4 mr-2" />
            )}
            <span className="flex-1 text-left">
              {getSkeletonButtonText()}
            </span>
          </Button>

          {/* Video Overlay Button */}
          <Button
            ref={overlayButtonRef}
            onClick={onToggleVideoOverlay}
            variant={isVideoOverlayEnabled ? "default" : "secondary"}
            className="justify-start"
            disabled={!isCameraActive || !isInitialized || webglContextLost}
          >
            {isVideoOverlayEnabled ? (
              <Video className="w-4 h-4 mr-2" />
            ) : (
              <VideoOff className="w-4 h-4 mr-2" />
            )}
            <span className="flex-1 text-left">
              {getOverlayButtonText()}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
