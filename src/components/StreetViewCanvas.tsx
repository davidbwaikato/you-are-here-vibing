import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded, setDestinationLocation, setSourceAddress, setDestinationAddress } from '@/store/streetViewSlice';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { LocationOverlay } from './LocationOverlay';

interface StreetViewCanvasProps {
  isGoogleMapsLoaded: boolean;
  sourceLocation: { lat: number; lng: number } | null;
  destinationLocation: { lat: number; lng: number } | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  hasSourceError: boolean;
}

export const StreetViewCanvas = ({
  isGoogleMapsLoaded,
  sourceLocation,
  destinationLocation,
  sourceAddress,
  destinationAddress,
  hasSourceError,
}: StreetViewCanvasProps) => {
  const dispatch = useDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [isPanoramaReady, setIsPanoramaReady] = useState(false);
  const isUpdatingPovRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const shouldCleanupRef = useRef(false); // NEW: Track if we should actually cleanup
  
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);

  console.log('[StreetView] Component render - isGoogleMapsLoaded:', isGoogleMapsLoaded, 'isPanoramaReady:', isPanoramaReady);

  // Update Redux store with addresses ONCE on mount
  useEffect(() => {
    if (sourceAddress) {
      console.log('[StreetView] Setting source address:', sourceAddress);
      dispatch(setSourceAddress(sourceAddress));
    }
  }, []); // Empty deps - only run once

  useEffect(() => {
    if (destinationAddress) {
      console.log('[StreetView] Setting destination address:', destinationAddress);
      dispatch(setDestinationAddress(destinationAddress));
    }
  }, []); // Empty deps - only run once

  // Update Redux store with destination location ONCE on mount
  useEffect(() => {
    if (destinationLocation) {
      console.log('[StreetView] Setting destination location:', destinationLocation);
      dispatch(setDestinationLocation(destinationLocation));
    }
  }, []); // Empty deps - only run once

  // Initialize Street View panorama ONCE
  useEffect(() => {
    console.log('[StreetView] Panorama init effect - isGoogleMapsLoaded:', isGoogleMapsLoaded, 'containerRef:', !!containerRef.current, 'panoramaRef:', !!panoramaRef.current, 'hasInitialized:', hasInitializedRef.current);
    
    if (!isGoogleMapsLoaded) {
      console.log('[StreetView] Cannot initialize panorama - Google Maps not loaded yet');
      return;
    }

    if (!containerRef.current) {
      console.log('[StreetView] Cannot initialize panorama - container ref not ready');
      return;
    }

    if (hasInitializedRef.current) {
      console.log('[StreetView] Panorama already initialized, skipping');
      return;
    }

    console.log('[StreetView] ✅ All conditions met, initializing panorama...');
    console.log('[StreetView] Container ref:', containerRef.current);
    console.log('[StreetView] Position:', position);
    console.log('[StreetView] POV:', pov);
    console.log('[StreetView] Zoom:', zoom);

    hasInitializedRef.current = true;
    shouldCleanupRef.current = false; // Don't cleanup yet

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
      console.log('[StreetView] 🎯 Status changed:', status);
      if (status === 'OK') {
        console.log('[StreetView] ✅ Panorama ready! Setting isLoaded to true');
        dispatch(setLoaded(true));
        setIsPanoramaReady(true);
        shouldCleanupRef.current = true; // Now we can cleanup on unmount
      } else {
        console.log('[StreetView] ❌ Panorama status not OK:', status);
      }
    });

    console.log('[StreetView] Panorama initialized, waiting for status_changed event...');

    return () => {
      // Only cleanup if we've successfully initialized
      if (shouldCleanupRef.current && panoramaRef.current) {
        console.log('[StreetView] Cleaning up panorama (component unmounting)');
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      } else {
        console.log('[StreetView] Skipping cleanup (Strict Mode double-invocation)');
      }
    };
  }, [isGoogleMapsLoaded]); // Only depend on isGoogleMapsLoaded

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

  // Update panorama position when source location changes
  useEffect(() => {
    if (!panoramaRef.current || !sourceLocation || hasSourceError || !isPanoramaReady) {
      return;
    }

    console.log('[StreetView] Updating position to:', sourceLocation);
    panoramaRef.current.setPosition(sourceLocation);
  }, [sourceLocation, hasSourceError, isPanoramaReady]);

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
