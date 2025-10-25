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

// Debug flag to control console logging
const DEBUG_APP = false;

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const isCheckingGoogleMaps = useRef(false);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

  // Initialize proximity-based and keyboard-based audio playback
  if (DEBUG_APP) {
    console.log('[App] 🎵 About to call useProximityAudio hook...');
  }
  const audioState = useProximityAudio();
  if (DEBUG_APP) {
    console.log('[App] 🎵 useProximityAudio hook returned:', audioState);
  }

  // Log audio state changes to console
  useEffect(() => {
    if (!audioState.isAudioReady) return;

    if (DEBUG_APP) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎵 AUDIO STATUS UPDATE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Playback Status
      if (audioState.currentlyPlaying) {
        console.log(`▶️  Currently Playing: ${audioState.currentlyPlaying.toUpperCase()}`);
        if (audioState.keyboardControlActive) {
          console.log('⌨️  Control Method: KEYBOARD');
        } else {
          console.log('📍 Control Method: PROXIMITY');
        }
      } else {
        console.log('⏸️  No audio playing');
      }
      
      // Proximity Status
      console.log('\n📍 PROXIMITY STATUS:');
      console.log(`   Source: ${audioState.isInsideSource ? '✅ Inside cuboid' : '❌ Outside cuboid'}`);
      console.log(`   Destination: ${audioState.isInsideDestination ? '✅ Inside cuboid' : '❌ Outside cuboid'}`);
      
      // Keyboard Controls
      console.log('\n⌨️  KEYBOARD CONTROLS:');
      console.log('   Press [I] - Toggle Source Audio');
      console.log('   Press [O] - Toggle Destination Audio');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }, [
    audioState.isAudioReady,
    audioState.currentlyPlaying,
    audioState.isInsideSource,
    audioState.isInsideDestination,
    audioState.keyboardControlActive
  ]);

  // Check if Google Maps is loaded - SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (isCheckingGoogleMaps.current) {
      return;
    }

    isCheckingGoogleMaps.current = true;

    if (DEBUG_APP) {
      console.log('[App] 🚀 Starting initialization sequence...');
      console.log('[App] ⏳ Step 1: Loading Google Maps API...');
    }

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        if (DEBUG_APP) {
          console.log('[App] ✅ Step 1 complete: Google Maps API loaded');
        }
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
      if (DEBUG_APP) {
        console.log('[App] ✅ All initialization steps complete (including panorama)');
        console.log('[App] 🎬 Ready to show main interface');
      }
    }
  }, [isGoogleMapsLoaded, isInitializing, isLoaded]);

  // Show error page if there's a source location error
  if (hasSourceError && attemptedSourceLocation) {
    console.error('[App] ❌ Showing error page for:', attemptedSourceLocation);
    return <LocationErrorPage attemptedLocation={attemptedSourceLocation} errorMessage={error || ''} />;
  }

  // Determine what to show
  const canShowStreetView = isGoogleMapsLoaded && !isInitializing;
  const shouldShowSplash = !canShowStreetView || !isLoaded;

  if (DEBUG_APP) {
    console.log('[App] Render state:', {
      isGoogleMapsLoaded,
      isInitializing,
      isLoaded,
      canShowStreetView,
      shouldShowSplash
    });

    console.log('[App] 🎵 Current audio state:', audioState);
  }

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
