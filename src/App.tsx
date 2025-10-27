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

type AppPhase = 'splash' | 'location-search' | 'preparation' | 'street-view';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('splash');
  const isCheckingGoogleMaps = useRef(false);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

  // Initialize proximity-based and keyboard-based audio playback
  useProximityAudio();

  // PHASE 1: SPLASH SCREEN - Load Google Maps API
  useEffect(() => {
    if (isCheckingGoogleMaps.current) return;
    isCheckingGoogleMaps.current = true;

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        setIsGoogleMapsLoaded(true);
        setCurrentPhase('location-search');
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Get location parameters
  const { 
    sourceError,
    destinationError,
    isInitializing,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
  } = useLocationParams(isGoogleMapsLoaded);

  // Check if we should show preparation screen
  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowPreparation = urlParams.has('start') && urlParams.get('start') === 'true';

  // PHASE 2 → PHASE 3: Transition to preparation screen
  useEffect(() => {
    if (shouldShowPreparation && currentPhase === 'location-search' && !isInitializing) {
      setCurrentPhase('preparation');
    }
  }, [shouldShowPreparation, currentPhase, isInitializing]);

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
        onPreparationComplete={() => setCurrentPhase('street-view')}
      />
    );
  }

  // PHASE 4: Street View Panorama
  if (currentPhase === 'street-view') {
    const canShowStreetView = isGoogleMapsLoaded && !isInitializing;
    const shouldShowSplash = !canShowStreetView || !isLoaded;

    return (
      <>
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
