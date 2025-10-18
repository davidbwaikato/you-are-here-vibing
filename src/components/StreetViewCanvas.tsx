import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded, setDestinationLocation, setSourceAddress, setDestinationAddress } from '@/store/streetViewSlice';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { LocationOverlay } from './LocationOverlay';
import { useLocationParams } from '@/hooks/useLocationParams';

export const StreetViewCanvas = () => {
  const dispatch = useDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [isPanoramaReady, setIsPanoramaReady] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const isCheckingGoogleMaps = useRef(false);
  const isUpdatingPovRef = useRef(false);
  
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);

  // Check if Google Maps is loaded - only once
  useEffect(() => {
    if (isCheckingGoogleMaps.current) {
      console.log('[StreetView] Already checking Google Maps, skipping');
      return;
    }

    isCheckingGoogleMaps.current = true;

    console.log('[StreetView] Starting Google Maps check...');
    console.log('[StreetView] window.google exists?', typeof window.google !== 'undefined');
    console.log('[StreetView] window.google.maps exists?', typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined');

    const checkGoogleMaps = () => {
      const hasGoogle = typeof window.google !== 'undefined';
      const hasMaps = hasGoogle && typeof window.google.maps !== 'undefined';
      
      console.log('[StreetView] Check attempt - hasGoogle:', hasGoogle, 'hasMaps:', hasMaps);
      
      if (hasMaps) {
        console.log('[StreetView] ✅ Google Maps loaded successfully! Setting state...');
        setIsGoogleMapsLoaded(true);
        console.log('[StreetView] State update called');
      } else {
        console.log('[StreetView] ⏳ Waiting for Google Maps... will retry in 100ms');
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Log when isGoogleMapsLoaded changes
  useEffect(() => {
    console.log('[StreetView] isGoogleMapsLoaded state changed to:', isGoogleMapsLoaded);
  }, [isGoogleMapsLoaded]);

  // Get location parameters
  const {
    isLoading,
    error,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
    hasSourceError,
  } = useLocationParams(isGoogleMapsLoaded);

  // Initialize Street View panorama
  useEffect(() => {
    console.log('[StreetView] Panorama init effect - isGoogleMapsLoaded:', isGoogleMapsLoaded, 'containerRef:', !!containerRef.current, 'panoramaRef:', !!panoramaRef.current);
    
    if (!isGoogleMapsLoaded) {
      console.log('[StreetView] Cannot initialize panorama - Google Maps not loaded yet');
      return;
    }

    if (!containerRef.current) {
      console.log('[StreetView] Cannot initialize panorama - container ref not ready');
      return;
    }

    if (panoramaRef.current) {
      console.log('[StreetView] Panorama already initialized, skipping');
      return;
    }

    console.log('[StreetView] ✅ All conditions met, initializing panorama...');
    console.log('[StreetView] Container ref:', containerRef.current);
    console.log('[StreetView] Position:', position);
    console.log('[StreetView] POV:', pov);
    console.log('[StreetView] Zoom:', zoom);

    const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
      position,
      pov,
      zoom,
      addressControl: false,
      linksControl: false,
      panControl: false,
      enableCloseButton: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      showRoadLabels: false,
      zoomControl: false,
      clickToGo: true,
      scrollwheel: true,
      disableDefaultUI: true,
      imageDateControl: false,
    });

    console.log('[StreetView] Panorama object created:', panorama);
    panoramaRef.current = panorama;

    // Listen for position changes
    panorama.addListener('position_changed', () => {
      const newPosition = panorama.getPosition();
      if (newPosition) {
        const lat = newPosition.lat();
        const lng = newPosition.lng();
        console.log('[StreetView] Position changed:', { lat, lng });
        dispatch(setPosition({ lat, lng }));
      }
    });

    // Listen for POV changes (from user interaction)
    panorama.addListener('pov_changed', () => {
      if (isUpdatingPovRef.current) {
        console.log('[StreetView] POV change from programmatic update, ignoring');
        return;
      }
      
      const newPov = panorama.getPov();
      console.log('[StreetView] POV changed by user:', newPov);
      dispatch(setPov({ heading: newPov.heading, pitch: newPov.pitch }));
    });

    // Listen for zoom changes
    panorama.addListener('zoom_changed', () => {
      const newZoom = panorama.getZoom();
      console.log('[StreetView] Zoom changed:', newZoom);
      dispatch(setZoom(newZoom));
    });

    // Mark as loaded when panorama is ready
    panorama.addListener('status_changed', () => {
      const status = panorama.getStatus();
      console.log('[StreetView] Status changed:', status);
      if (status === 'OK') {
        console.log('[StreetView] ✅ Panorama ready!');
        dispatch(setLoaded(true));
        setIsPanoramaReady(true);
      } else {
        console.log('[StreetView] ❌ Panorama status not OK:', status);
      }
    });

    console.log('[StreetView] Panorama initialized, waiting for status_changed event...');

    return () => {
      console.log('[StreetView] Cleaning up panorama');
      if (panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, [isGoogleMapsLoaded, position, zoom, dispatch]);

  // Update panorama POV when Redux state changes (from motion tracking)
  useEffect(() => {
    if (!panoramaRef.current || !isPanoramaReady) {
      return;
    }

    console.log('[StreetView] Updating panorama POV to:', pov);
    
    isUpdatingPovRef.current = true;
    panoramaRef.current.setPov({
      heading: pov.heading,
      pitch: pov.pitch
    });
    
    // Reset flag after a short delay to allow the pov_changed event to fire
    setTimeout(() => {
      isUpdatingPovRef.current = false;
    }, 50);
  }, [pov, isPanoramaReady]);

  // Update panorama position when location params change
  useEffect(() => {
    if (!panoramaRef.current || !sourceLocation || isLoading || hasSourceError) {
      return;
    }

    console.log('[StreetView] Updating position to:', sourceLocation);
    panoramaRef.current.setPosition(sourceLocation);
    dispatch(setPosition(sourceLocation));
  }, [sourceLocation, isLoading, hasSourceError, dispatch]);

  // Update Redux store with addresses
  useEffect(() => {
    if (sourceAddress) {
      console.log('[StreetView] Setting source address:', sourceAddress);
      dispatch(setSourceAddress(sourceAddress));
    }
  }, [sourceAddress, dispatch]);

  useEffect(() => {
    if (destinationAddress) {
      console.log('[StreetView] Setting destination address:', destinationAddress);
      dispatch(setDestinationAddress(destinationAddress));
    }
  }, [destinationAddress, dispatch]);

  // Update Redux store with destination location
  useEffect(() => {
    if (destinationLocation) {
      console.log('[StreetView] Setting destination location:', destinationLocation);
      dispatch(setDestinationLocation(destinationLocation));
    }
  }, [destinationLocation, dispatch]);

  console.log('[StreetView] Render - isLoading:', isLoading, 'isGoogleMapsLoaded:', isGoogleMapsLoaded, 'error:', error, 'hasSourceError:', hasSourceError);

  // Show loading state
  if (isLoading || !isGoogleMapsLoaded) {
    console.log('[StreetView] Showing loading state');
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
        <div className="text-white text-2xl font-light">
          {!isGoogleMapsLoaded ? 'Loading Google Maps...' : 'Loading location...'}
        </div>
      </div>
    );
  }

  // Show error state
  if (error || hasSourceError) {
    console.log('[StreetView] Has error, returning null');
    return null; // Error page will be shown by parent component
  }

  console.log('[StreetView] Rendering panorama container and overlays');

  return (
    <>
      <div 
        ref={containerRef} 
        className="fixed inset-0"
        style={{ 
          zIndex: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#000'
        }}
      />
      {isPanoramaReady && (
        <>
          <MotionTrackingOverlay panoramaRef={panoramaRef} />
          <LocationOverlay />
        </>
      )}
    </>
  );
};
