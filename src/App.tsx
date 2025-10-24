import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';
import { SplashScreen } from './components/SplashScreen';
import { LocationErrorPage } from './components/LocationErrorPage';
import { useState, useEffect, useRef } from 'react';
import { useLocationParams } from './hooks/useLocationParams';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';
import { useProximityAudio } from './hooks/useProximityAudio';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const isCheckingGoogleMaps = useRef(false);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

  // Initialize proximity-based and keyboard-based audio playback
  console.log('[App] 🎵 About to call useProximityAudio hook...');
  const audioState = useProximityAudio();
  console.log('[App] 🎵 useProximityAudio hook returned:', audioState);

  // Check if Google Maps is loaded - SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (isCheckingGoogleMaps.current) {
      return;
    }

    isCheckingGoogleMaps.current = true;

    console.log('[App] 🚀 Starting initialization sequence...');
    console.log('[App] ⏳ Step 1: Loading Google Maps API...');

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        console.log('[App] ✅ Step 1 complete: Google Maps API loaded');
        setIsGoogleMapsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Get location parameters - waits for Google Maps to be loaded
  const { 
    error, 
    hasSourceError, 
    attemptedSourceLocation, 
    isInitializing,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
  } = useLocationParams(isGoogleMapsLoaded);

  // Log when fully ready
  useEffect(() => {
    if (isGoogleMapsLoaded && !isInitializing && isLoaded) {
      console.log('[App] ✅ All initialization steps complete (including panorama)');
      console.log('[App] 🎬 Ready to show main interface');
    }
  }, [isGoogleMapsLoaded, isInitializing, isLoaded]);

  // Show error page if there's a source location error
  if (hasSourceError && attemptedSourceLocation) {
    console.log('[App] ❌ Showing error page for:', attemptedSourceLocation);
    return <LocationErrorPage attemptedLocation={attemptedSourceLocation} errorMessage={error || ''} />;
  }

  // Determine what to show
  const canShowStreetView = isGoogleMapsLoaded && !isInitializing;
  const shouldShowSplash = !canShowStreetView || !isLoaded;

  console.log('[App] Render state:', {
    isGoogleMapsLoaded,
    isInitializing,
    isLoaded,
    canShowStreetView,
    shouldShowSplash
  });

  console.log('[App] 🎵 Current audio state:', audioState);

  return (
    <>
      {/* Always render StreetViewCanvas once we have Google Maps and location params */}
      {canShowStreetView && (
        <StreetViewCanvas 
          isGoogleMapsLoaded={isGoogleMapsLoaded}
          sourceLocation={sourceLocation}
          destinationLocation={destinationLocation}
          sourceAddress={sourceAddress}
          destinationAddress={destinationAddress}
          hasSourceError={hasSourceError}
        />
      )}
      
      {/* Show splash screen on top until panorama is ready */}
      {shouldShowSplash && (
        <SplashScreen onComplete={() => {}} />
      )}

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
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-semibold">I</kbd>
              <span>Toggle Source Audio</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-semibold">O</kbd>
              <span>Toggle Destination Audio</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <Provider store={store}>
      <div className="w-full h-screen overflow-hidden">
        <AppContent />
      </div>
    </Provider>
  );
}

export default App;
