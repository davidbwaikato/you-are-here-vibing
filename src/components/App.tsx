import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { StreetViewPanorama } from './StreetViewPanorama';
import { ThreeJsCanvas } from './ThreeJsCanvas';
import { VideoOverlay } from './VideoOverlay';
import { ControlPanel } from './ControlPanel';
import { LoadingScreen } from './LoadingScreen';
import { useLocationParams } from '@/hooks/useLocationParams';
import { useProximityAudio } from '@/hooks/useProximityAudio';
import { setLoaded } from '@/store/streetViewSlice';

export const App = () => {
  const dispatch = useDispatch();
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [isStreetViewReady, setIsStreetViewReady] = useState(false);

  // Initialize location parameters and route
  const locationState = useLocationParams(isGoogleMapsLoaded);

  // Initialize proximity-based and keyboard-based audio playback
  const audioState = useProximityAudio();

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        console.log('[App] ✅ Google Maps API loaded');
        setIsGoogleMapsLoaded(true);
      } else {
        console.log('[App] ⏳ Waiting for Google Maps API...');
        setTimeout(checkGoogleMaps, 100);
      }
    };

    checkGoogleMaps();
  }, []);

  // Handle Street View ready state
  const handleStreetViewReady = () => {
    console.log('[App] ✅ Street View panorama ready');
    setIsStreetViewReady(true);
    dispatch(setLoaded(true));
  };

  // Show loading screen while initializing
  if (locationState.isInitializing || !isGoogleMapsLoaded) {
    return (
      <LoadingScreen 
        message={
          !isGoogleMapsLoaded 
            ? "Loading Google Maps..." 
            : locationState.hasSourceError && locationState.attemptedSourceLocation
            ? `Could not find location: "${locationState.attemptedSourceLocation}". Using default location...`
            : "Initializing location data..."
        }
      />
    );
  }

  console.log('[App] 🎵 Audio state:', audioState);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Street View Panorama */}
      <StreetViewPanorama 
        isReady={isGoogleMapsLoaded}
        onReady={handleStreetViewReady}
      />

      {/* Three.js Canvas Overlay */}
      <ThreeJsCanvas 
        isReady={isStreetViewReady}
      />

      {/* Video Overlay with Pose Detection */}
      <VideoOverlay />

      {/* Control Panel */}
      <ControlPanel />

      {/* Audio Status Indicator */}
      {audioState.isAudioReady && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white px-4 py-3 rounded-lg text-sm font-mono z-50 backdrop-blur-sm border border-white/10">
          {/* Playback Status */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${
              audioState.currentlyPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`} />
            <span className="font-semibold">
              {audioState.currentlyPlaying 
                ? `Playing: ${audioState.currentlyPlaying}` 
                : 'No audio playing'}
            </span>
            {audioState.keyboardControlActive && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                ⌨️ Keyboard
              </span>
            )}
          </div>

          {/* Proximity Status */}
          <div className="text-xs text-gray-400 mb-2">
            <div className="flex items-center gap-2">
              <span className={audioState.isInsideSource ? 'text-green-400' : 'text-gray-500'}>
                Source: {audioState.isInsideSource ? '✓ Inside' : '✗ Outside'}
              </span>
              <span className="text-gray-600">|</span>
              <span className={audioState.isInsideDestination ? 'text-green-400' : 'text-gray-500'}>
                Destination: {audioState.isInsideDestination ? '✓ Inside' : '✗ Outside'}
              </span>
            </div>
          </div>

          {/* Keyboard Controls Help */}
          <div className="text-xs text-gray-500 border-t border-white/10 pt-2 space-y-1">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-semibold">S</kbd>
              <span>Toggle Source Audio</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-semibold">D</kbd>
              <span>Toggle Destination Audio</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
