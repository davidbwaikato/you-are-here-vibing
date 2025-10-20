import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';
import { SplashScreen } from './components/SplashScreen';
import { LocationErrorPage } from './components/LocationErrorPage';
import { useState, useEffect, useRef } from 'react';
import { useLocationParams } from './hooks/useLocationParams';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';

function AppContent() {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const isCheckingGoogleMaps = useRef(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const isLoaded = useSelector((state: RootState) => state.streetView.isLoaded);

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
      
      // Directly set splash visibility to false when Street View is loaded
      setIsSplashVisible(false);
    }
  }, [isGoogleMapsLoaded, isInitializing, isLoaded]);

  // Show error page if there's a source location error
  if (hasSourceError && attemptedSourceLocation) {
    console.log('[App] ❌ Showing error page for:', attemptedSourceLocation);
    return <LocationErrorPage attemptedLocation={attemptedSourceLocation} errorMessage={error || ''} />;
  }

  // Determine what to show
  const canShowStreetView = isGoogleMapsLoaded && !isInitializing;
  const shouldShowSplash = isSplashVisible;

  console.log('[App] Render state:', {
    isGoogleMapsLoaded,
    isInitializing,
    isLoaded,
    canShowStreetView,
    shouldShowSplash
  });

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
          isSplashVisible={shouldShowSplash}
        />
      )}
      
      {/* Show splash screen on top until panorama is ready */}
      {shouldShowSplash && (
        <SplashScreen 
          onComplete={() => setIsSplashVisible(false)} 
          isVisible={shouldShowSplash}
        />
      )}
    </>
  );
};

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
