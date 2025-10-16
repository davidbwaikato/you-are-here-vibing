import { Camera, CameraOff, Compass, RotateCw, Eye, EyeOff, Video, VideoOff } from 'lucide-react';

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
  onToggleTracking,
  onToggleSkeletonVisibility,
  onToggleVideoOverlay,
}: TrackingControlsProps) => {
  return (
    <>
      {/* Left Side - Information Displays */}
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-3">
        {/* POV Heading Display */}
        <div className="w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-none">
          <Compass className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-xs text-blue-400 font-mono">
            Heading: {heading.toFixed(1)}°
          </span>
        </div>

        {/* Shoulder Rotation Display */}
        <div className="w-48 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-none">
          <RotateCw className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-400 font-mono">
            Swivel: {shoulderAngle !== null ? `${shoulderAngle.toFixed(1)}°` : '--'}
          </span>
        </div>
      </div>

      {/* Right Side - Toggle Buttons */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {/* Tracking Status Toggle Button */}
        <button
          onClick={onToggleTracking}
          className="w-52 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
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

        {/* Video Overlay Toggle Button */}
        <button
          onClick={onToggleVideoOverlay}
          className="w-52 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
        >
          {isVideoOverlayEnabled ? (
            <>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse flex-shrink-0" />
              <Video className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-xs text-purple-400 font-mono">
                Overlay: {segmentationFps.toFixed(1)}/sec
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
              <VideoOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Overlay Off</span>
            </>
          )}
        </button>

        {/* Skeleton Visibility Toggle Button */}
        <button
          onClick={onToggleSkeletonVisibility}
          className="w-52 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
        >
          {isSkeletonVisible ? (
            <>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0" />
              <Eye className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="text-xs text-indigo-400 font-mono">
                Skeleton: {detectionFps.toFixed(1)}/sec
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
              <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 font-mono">
                Skeleton: {detectionFps.toFixed(1)}/sec
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
};
