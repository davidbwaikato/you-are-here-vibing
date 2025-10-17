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
  renderFps: number;
  webglContextLost: boolean;
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
  renderFps,
  webglContextLost,
  onToggleTracking,
  onToggleSkeletonVisibility,
  onToggleVideoOverlay,
}: TrackingControlsProps) => {
  const formatAngle = (angle: number) => {
    return angle.toFixed(1);
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
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg">
              <div className="text-sm font-medium">
                POV Heading: {formatAngle(heading)}°
              </div>
            </div>
          )}

          {/* Shoulder Rotation Display */}
          {isCameraActive && isInitialized && shoulderAngle !== null && (
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg">
              <div className="text-sm font-medium">
                Shoulder Rotation: {formatAngle(shoulderAngle)}°
              </div>
            </div>
          )}
        </div>

        {/* Right side - Toggle controls */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Tracking Status Button */}
          <Button
            onClick={onToggleTracking}
            variant={isTrackingEnabled ? "default" : "secondary"}
            className="w-52 justify-start"
            disabled={!isCameraActive || !isInitialized || webglContextLost}
          >
            <Activity className="w-4 h-4 mr-2" />
            {isTrackingEnabled ? 'Tracking Active' : 'Tracking Paused'}
          </Button>

          {/* Skeleton Visibility Button */}
          <Button
            onClick={onToggleSkeletonVisibility}
            variant={isSkeletonVisible ? "default" : "secondary"}
            className="w-52 justify-start"
            disabled={!isCameraActive || !isInitialized}
          >
            {isSkeletonVisible ? (
              <Eye className="w-4 h-4 mr-2" />
            ) : (
              <EyeOff className="w-4 h-4 mr-2" />
            )}
            <span className="flex-1 text-left">
              {isSkeletonVisible ? 'Hide Skeleton' : 'Show Skeleton'}
            </span>
            <span className="text-xs opacity-70 ml-2">
              {detectionFps > 0 ? `${detectionFps.toFixed(1)}/sec` : '0.0/sec'}
            </span>
          </Button>

          {/* Video Overlay Button */}
          <Button
            onClick={onToggleVideoOverlay}
            variant={isVideoOverlayEnabled ? "default" : "secondary"}
            className="w-52 justify-start"
            disabled={!isCameraActive || !isInitialized || webglContextLost}
          >
            {isVideoOverlayEnabled ? (
              <Video className="w-4 h-4 mr-2" />
            ) : (
              <VideoOff className="w-4 h-4 mr-2" />
            )}
            <span className="flex-1 text-left">
              {isVideoOverlayEnabled ? 'Overlay On' : 'Overlay Off'}
            </span>
            <span className="text-xs opacity-70 ml-2">
              {segmentationFps > 0 ? `${segmentationFps.toFixed(1)}/sec` : '0.0/sec'}
            </span>
          </Button>

          {/* Render FPS Display */}
          {isCameraActive && isInitialized && (
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
              Render: {renderFps > 0 ? `${renderFps.toFixed(1)}/sec` : '0.0/sec'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
