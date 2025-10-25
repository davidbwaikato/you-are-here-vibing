import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';
import { SplashScreen } from './components/SplashScreen';
import { LocationSearchPage } from './components/LocationSearchPage';
import { useState, useEffect, useRef } from 'react';
import { useLocationParams } from './hooks/useLocationParams';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';
import { useProximityAudio } from './hooks/useProximityAudio';

// Debug flag to control console logging
const DEBUG_APP = false;

// App phases
type AppPhase = 'splash' | 'location-search' | 'street-view';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('splash');
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
      console.log('[App] 🚀 Phase 1: SPLASH SCREEN - Loading Google Maps API...');
    }

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        if (DEBUG_APP) {
          console.log('[App] ✅ Google Maps API loaded');
          console.log('[App] 🎬 Transitioning to Phase 2: LOCATION SEARCH PAGE');
        }
        setIsGoogleMapsLoaded(true);
        // Transition from splash to location search page
        setCurrentPhase('location-search');
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Get location parameters - waits for Google Maps to be loaded
  const { 
    error, 
    sourceError,
    destinationError,
    sourceRecognized,
    destinationRecognized,
    isInitializing,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
  } = useLocationParams(isGoogleMapsLoaded);

  // Check if we should show StreetView (user clicked "Start Your Exploration")
  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowStreetView = urlParams.has('start') && urlParams.get('start') === 'true';

  // Handle phase transitions
  useEffect(() => {
    if (shouldShowStreetView && currentPhase === 'location-search' && !isInitializing) {
      if (DEBUG_APP) {
        console.log('[App] 🎬 Transitioning to Phase 3: STREET VIEW PANORAMA');
      }
      setCurrentPhase('street-view');
    }
  }, [shouldShowStreetView, currentPhase, isInitializing]);

  if (DEBUG_APP) {
    console.log('[App] Current phase:', currentPhase);
    console.log('[App] Render state:', {
      isGoogleMapsLoaded,
      isInitializing,
      isLoaded,
      currentPhase,
      shouldShowStreetView
    });
  }

  // Phase 1: Splash Screen
  if (currentPhase === 'splash') {
    return <SplashScreen onComplete={() => {}} />;
  }

  // Phase 2: Location Search Page
  if (currentPhase === 'location-search') {
    return (
      <LocationSearchPage 
        sourceError={sourceError} 
        destinationError={destinationError}
      />
    );
  }

  // Phase 3: Street View Panorama
  if (currentPhase === 'street-view') {
    const canShowStreetView = isGoogleMapsLoaded && !isInitializing;
    const shouldShowSplash = !canShowStreetView || !isLoaded;

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
            hasSourceError={false}
          />
        )}
        
        {/* Show splash screen on top until panorama is ready */}
        {shouldShowSplash && (
          <SplashScreen onComplete={() => {}} />
        )}
      </>
    );
  }

  return null;
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
