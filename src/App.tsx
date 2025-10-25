import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';
import { SplashScreen } from './components/SplashScreen';
import { LocationSearchPage } from './components/LocationSearchPage';
import { PreparationScreen } from './components/PreparationScreen';
import { useState, useEffect, useRef } from 'react';
import { useLocationParams } from './hooks/useLocationParams';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';
import { useProximityAudio } from './hooks/useProximityAudio';

// Debug flag to control console logging
const DEBUG_APP = true;

// App phases
type AppPhase = 'splash' | 'location-search' | 'preparation' | 'street-view';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('splash');
  const isCheckingGoogleMaps = useRef(false);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

  // Get audio data from Redux to verify it's available
  const sourceDetails = useSelector((state: RootState) => state.streetView.sourceDetails);
  const destinationDetails = useSelector((state: RootState) => state.streetView.destinationDetails);

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

  // PHASE 1: SPLASH SCREEN - Load Google Maps API
  useEffect(() => {
    if (isCheckingGoogleMaps.current) {
      return;
    }

    isCheckingGoogleMaps.current = true;

    console.log('[App] 🚀 PHASE 1: SPLASH SCREEN');
    console.log('[App] 📚 Loading Google Maps API...');
    console.log('[App] 📚 Loading HandPose.js...');
    console.log('[App] 📚 Initializing OpenAI API (general)...');

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        console.log('[App] ✅ Google Maps API loaded');
        console.log('[App] ✅ General initialization complete');
        console.log('[App] 🎬 Transitioning to PHASE 2: LOCATION SEARCH PAGE');
        setIsGoogleMapsLoaded(true);
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

  // Check if we should show preparation screen (user clicked "Start Your Exploration")
  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowPreparation = urlParams.has('start') && urlParams.get('start') === 'true';

  // PHASE 2 → PHASE 3: Transition to preparation screen
  useEffect(() => {
    if (shouldShowPreparation && currentPhase === 'location-search' && !isInitializing) {
      console.log('[App] 🎬 Transitioning to PHASE 3: PREPARATION SCREEN');
      setCurrentPhase('preparation');
    }
  }, [shouldShowPreparation, currentPhase, isInitializing]);

  // Debug: Log audio data availability
  useEffect(() => {
    if (currentPhase === 'street-view') {
      console.log('[App] 🎵 PHASE 4 - Checking audio data availability:', {
        hasSourceAudio: !!sourceDetails?.audioUrl,
        hasDestinationAudio: !!destinationDetails?.audioUrl,
        sourceAudioUrl: sourceDetails?.audioUrl?.substring(0, 50) + '...',
        destinationAudioUrl: destinationDetails?.audioUrl?.substring(0, 50) + '...',
        sourceFilename: sourceDetails?.audioFilename,
        destinationFilename: destinationDetails?.audioFilename,
      });
    }
  }, [currentPhase, sourceDetails, destinationDetails]);

  if (DEBUG_APP) {
    console.log('[App] Current phase:', currentPhase);
    console.log('[App] Render state:', {
      isGoogleMapsLoaded,
      isInitializing,
      isLoaded,
      currentPhase,
      shouldShowPreparation,
      hasSourceAudio: !!sourceDetails?.audioUrl,
      hasDestinationAudio: !!destinationDetails?.audioUrl,
    });
  }

  // PHASE 1: Splash Screen
  if (currentPhase === 'splash') {
    return <SplashScreen onComplete={() => {}} />;
  }

  // PHASE 2: Location Search Page
  if (currentPhase === 'location-search') {
    return (
      <LocationSearchPage 
        sourceError={sourceError} 
        destinationError={destinationError}
      />
    );
  }

  // PHASE 3: Preparation Screen
  if (currentPhase === 'preparation') {
    return (
      <PreparationScreen
        sourceLocation={sourceLocation}
        destinationLocation={destinationLocation}
        sourceAddress={sourceAddress}
        destinationAddress={destinationAddress}
        onPreparationComplete={() => {
          console.log('[App] 🎬 Transitioning to PHASE 4: STREET VIEW PANORAMA');
          console.log('[App] 🎵 Audio data at transition:', {
            hasSourceAudio: !!sourceDetails?.audioUrl,
            hasDestinationAudio: !!destinationDetails?.audioUrl,
          });
          setCurrentPhase('street-view');
        }}
      />
    );
  }

  // PHASE 4: Street View Panorama
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
