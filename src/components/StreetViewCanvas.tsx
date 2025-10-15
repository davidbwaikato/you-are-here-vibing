import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded } from '@/store/streetViewSlice';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { SplashScreen } from './SplashScreen';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const StreetViewCanvas = () => {
  const panoramaRef = useRef<HTMLDivElement>(null);
  const streetViewRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const isUpdatingFromReduxRef = useRef(false); // Track if we're updating from Redux
  const dispatch = useDispatch();
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);
  const { isLoaded, loadError } = useGoogleMaps();
  const [showSplash, setShowSplash] = useState(true);
  const [streetViewReady, setStreetViewReady] = useState(false);

  // Log Redux state changes
  useEffect(() => {
    console.log('[StreetViewCanvas] Redux state updated:', {
      position,
      pov,
      zoom
    });
  }, [position, pov, zoom]);

  useEffect(() => {
    if (!isLoaded || !panoramaRef.current || streetViewRef.current) return;

    console.log('[StreetViewCanvas] Initializing Google Street View panorama...');
    
    const panorama = new google.maps.StreetViewPanorama(panoramaRef.current, {
      position: position,
      pov: pov,
      zoom: zoom,
      disableDefaultUI: true,
      linksControl: false,
      panControl: false,
      enableCloseButton: false,
      fullscreenControl: false,
      addressControl: false,
      showRoadLabels: false,
    });
    
    console.log('[StreetViewCanvas] Panorama created with initial config:', {
      position,
      pov,
      zoom
    });
		
    streetViewRef.current = panorama;

    panorama.addListener('status_changed', () => {
      const status = panorama.getStatus();
      console.log('[StreetViewCanvas] Status changed:', status);
      if (status === 'OK') {
        setStreetViewReady(true);
        dispatch(setLoaded(true));
        console.log('[StreetViewCanvas] ✓ Street View ready');
      }
    });

    panorama.addListener('position_changed', () => {
      const newPosition = panorama.getPosition();
      if (newPosition) {
        console.log('[StreetViewCanvas] Position changed (from panorama):', {
          lat: newPosition.lat(),
          lng: newPosition.lng()
        });
        dispatch(setPosition({
          lat: newPosition.lat(),
          lng: newPosition.lng(),
        }));
      }
    });

    panorama.addListener('pov_changed', () => {
      // CRITICAL: Only dispatch if the change came from user interaction, not from Redux
      if (isUpdatingFromReduxRef.current) {
        console.log('[StreetViewCanvas] POV changed from Redux update - ignoring to prevent loop');
        return;
      }

      const newPov = panorama.getPov();
      console.log('[StreetViewCanvas] POV changed (from user interaction):', newPov);
      dispatch(setPov({
        heading: newPov.heading,
        pitch: newPov.pitch,
      }));
    });

    panorama.addListener('zoom_changed', () => {
      const newZoom = panorama.getZoom();
      console.log('[StreetViewCanvas] Zoom changed (from panorama):', newZoom);
      dispatch(setZoom(newZoom));
    });

    return () => {
      console.log('[StreetViewCanvas] Cleaning up panorama listeners');
      if (streetViewRef.current) {
        google.maps.event.clearInstanceListeners(streetViewRef.current);
      }
    };
  }, [isLoaded, dispatch]);

  // Watch for Redux pov changes and update panorama
  useEffect(() => {
    if (!streetViewRef.current || !streetViewReady) {
      console.log('[StreetViewCanvas] Cannot update POV - panorama not ready:', {
        hasPanorama: !!streetViewRef.current,
        isReady: streetViewReady
      });
      return;
    }

    console.log('[StreetViewCanvas] Redux POV changed, updating panorama to:', pov);
    
    try {
      // Set flag to prevent pov_changed listener from dispatching
      isUpdatingFromReduxRef.current = true;
      
      streetViewRef.current.setPov(pov);
      console.log('[StreetViewCanvas] ✓ Panorama setPov() called successfully');
      
      // Verify the update
      const currentPov = streetViewRef.current.getPov();
      console.log('[StreetViewCanvas] Current panorama POV after update:', currentPov);
      
      // Reset flag after a short delay to allow the event to fire
      setTimeout(() => {
        isUpdatingFromReduxRef.current = false;
        console.log('[StreetViewCanvas] Reset isUpdatingFromRedux flag');
      }, 100);
    } catch (error) {
      console.error('[StreetViewCanvas] Error calling setPov():', error);
      isUpdatingFromReduxRef.current = false;
    }
  }, [pov, streetViewReady]);

  const handleTransitionComplete = () => {
    setShowSplash(false);
  };

  if (loadError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Google Maps</AlertTitle>
          <AlertDescription>
            {loadError.message}
            <br />
            <br />
            Please add your Google Maps API key to the <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code> file:
            <br />
            <code className="bg-slate-100 px-2 py-1 rounded block mt-2 text-xs">
              VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
            </code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      {showSplash && (
        <SplashScreen 
          isLoading={!streetViewReady} 
          onTransitionComplete={handleTransitionComplete}
        />
      )}
      <div 
        ref={panoramaRef} 
        className="w-full h-screen"
        style={{ position: 'relative' }}
      />
      {!showSplash && <MotionTrackingOverlay />}
    </>
  );
};
