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

  // Initialize proximity-based audio playback
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

      {/* Audio Status Indicator (for debugging) */}
      {audioState.isAudioReady && (
        <div className="fixed bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-mono z-50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              audioState.currentlyPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`} />
            <span>
              {audioState.currentlyPlaying 
                ? `Playing: ${audioState.currentlyPlaying}` 
                : 'No audio playing'}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Source: {audioState.isInsideSource ? '✓ Inside' : '✗ Outside'} | 
            Destination: {audioState.isInsideDestination ? '✓ Inside' : '✗ Outside'}
          </div>
        </div>
      )}
    </div>
  );
};
