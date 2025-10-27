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

type AppPhase = 'location-search' | 'preparation' | 'street-view';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('location-search');
  const isCheckingGoogleMaps = useRef(false);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

  useProximityAudio();

  // Load Google Maps API in background
  useEffect(() => {
    if (isCheckingGoogleMaps.current) return;
    isCheckingGoogleMaps.current = true;

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      if (hasMaps) {
        setIsGoogleMapsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  const { 
    sourceError,
    destinationError,
    isInitializing,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
  } = useLocationParams(isGoogleMapsLoaded);

  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowPreparation = urlParams.has('start') && urlParams.get('start') === 'true';

  useEffect(() => {
    if (shouldShowPreparation && currentPhase === 'location-search' && !isInitializing) {
      setCurrentPhase('preparation');
    }
  }, [shouldShowPreparation, currentPhase, isInitializing]);

  // PHASE 1: Location Search Page (always shown first)
  if (currentPhase === 'location-search') {
    return (
      <LocationSearchPage 
        sourceError={sourceError} 
        destinationError={destinationError}
      />
    );
  }

  // PHASE 2: Preparation Screen
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

  // PHASE 3: Street View Panorama
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
