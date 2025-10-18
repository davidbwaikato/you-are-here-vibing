import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';
import { SplashScreen } from './components/SplashScreen';
import { LocationErrorPage } from './components/LocationErrorPage';
import { useState, useEffect, useRef } from 'react';
import { useLocationParams } from './hooks/useLocationParams';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const isCheckingGoogleMaps = useRef(false);

  // Check if Google Maps is loaded - only once
  useEffect(() => {
    if (isCheckingGoogleMaps.current) {
      console.log('[App] Already checking Google Maps, skipping');
      return;
    }

    isCheckingGoogleMaps.current = true;

    console.log('[App] Starting Google Maps check...');
    console.log('[App] window.google exists?', typeof window.google !== 'undefined');
    console.log('[App] window.google.maps exists?', typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined');

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      console.log('[App] Check attempt - hasGoogle:', hasGoogle, 'hasMaps:', hasMaps);
      
      if (hasMaps) {
        console.log('[App] ✅ Google Maps loaded successfully! Setting state...');
        setIsGoogleMapsLoaded(true);
        console.log('[App] State update called');
      } else {
        console.log('[App] ⏳ Waiting for Google Maps... will retry in 100ms');
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Log when isGoogleMapsLoaded changes
  useEffect(() => {
    console.log('[App] isGoogleMapsLoaded state changed to:', isGoogleMapsLoaded);
  }, [isGoogleMapsLoaded]);

  const { error, hasSourceError, attemptedSourceLocation, isLoading } = useLocationParams(isGoogleMapsLoaded);

  const handleSplashComplete = () => {
    console.log('[App] Splash complete, isGoogleMapsLoaded:', isGoogleMapsLoaded);
    setShowSplash(false);
  };

  // Show splash screen first
  if (showSplash) {
    console.log('[App] Showing splash screen');
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  console.log('[App] After splash - isGoogleMapsLoaded:', isGoogleMapsLoaded, 'isLoading:', isLoading, 'hasSourceError:', hasSourceError);

  // Show error page if there's a source location error
  if (hasSourceError && attemptedSourceLocation) {
    console.log('[App] Showing error page for:', attemptedSourceLocation);
    return <LocationErrorPage attemptedLocation={attemptedSourceLocation} errorMessage={error || ''} />;
  }

  // Show main app
  console.log('[App] Showing StreetViewCanvas');
  return <StreetViewCanvas />;
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
