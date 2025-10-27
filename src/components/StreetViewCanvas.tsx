import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded, setDestinationLocation, setSourceAddress, setDestinationAddress } from '@/store/streetViewSlice';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { LocationOverlay } from './LocationOverlay';
import { ThreeJsCanvas } from './ThreeJsCanvas';
import { usePositionGeocoding } from '@/hooks/usePositionGeocoding';

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
  const shouldCleanupRef = useRef(false);
  const teleportCallbackRef = useRef<((markerIndex: number) => void) | null>(null);
  
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);

  usePositionGeocoding();

  useEffect(() => {
    if (sourceAddress) {
      dispatch(setSourceAddress(sourceAddress));
    }
  }, []);

  useEffect(() => {
    if (destinationAddress) {
      dispatch(setDestinationAddress(destinationAddress));
    }
  }, []);

  useEffect(() => {
    if (destinationLocation) {
      dispatch(setDestinationLocation(destinationLocation));
    }
  }, []);

  useEffect(() => {
    if (!isGoogleMapsLoaded || !containerRef.current || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    shouldCleanupRef.current = false;

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

    panoramaRef.current = panorama;

    panorama.addListener('position_changed', () => {
      const newPosition = panorama.getPosition();
      if (newPosition) {
        const lat = newPosition.lat();
        const lng = newPosition.lng();
        dispatch(setPosition({ lat, lng }));
      }
    });

    panorama.addListener('pov_changed', () => {
      if (isUpdatingPovRef.current) return;
      const newPov = panorama.getPov();
      console.log('[StreetView] 🖱️ POV changed by MOUSE:', {
        heading: newPov.heading.toFixed(2),
        pitch: newPov.pitch.toFixed(2),
      });
      dispatch(setPov({ 
        heading: newPov.heading, 
        pitch: newPov.pitch,
        source: 'mouse',
      }));
    });

    panorama.addListener('zoom_changed', () => {
      const newZoom = panorama.getZoom();
      dispatch(setZoom(newZoom));
    });

    panorama.addListener('status_changed', () => {
      const status = panorama.getStatus();
      if (status === 'OK') {
        dispatch(setLoaded(true));
        setIsPanoramaReady(true);
        shouldCleanupRef.current = true;
      }
    });

    return () => {
      if (shouldCleanupRef.current && panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, [isGoogleMapsLoaded]);

  useEffect(() => {
    if (!panoramaRef.current || !isPanoramaReady) return;

    const currentPosition = panoramaRef.current.getPosition();
    const currentLat = currentPosition?.lat();
    const currentLng = currentPosition?.lng();

    if (currentLat === position.lat && currentLng === position.lng) return;

    panoramaRef.current.setPosition(position);
  }, [position, isPanoramaReady]);

  useEffect(() => {
    if (!panoramaRef.current || !isPanoramaReady) return;

    isUpdatingPovRef.current = true;
    panoramaRef.current.setPov({
      heading: pov.heading,
      pitch: pov.pitch
    });
    
    setTimeout(() => {
      isUpdatingPovRef.current = false;
    }, 50);
  }, [pov, isPanoramaReady]);

  useEffect(() => {
    if (!panoramaRef.current || !sourceLocation || hasSourceError || !isPanoramaReady) return;
    console.log('[StreetView] 🚀 Teleporting to source location (TELEPORT)');
    panoramaRef.current.setPosition(sourceLocation);
  }, [sourceLocation, hasSourceError, isPanoramaReady]);

  const handleTeleportCallback = (teleportFn: (markerIndex: number) => void) => {
    teleportCallbackRef.current = teleportFn;
  };

  const handleTeleportToMarker = (markerIndex: number) => {
    if (teleportCallbackRef.current) {
      console.log('[StreetView] 🚀 Teleporting to marker (TELEPORT):', markerIndex);
      teleportCallbackRef.current(markerIndex);
    }
  };

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
          <ThreeJsCanvas isReady={isPanoramaReady} onTeleportToMarker={handleTeleportCallback} />
          <MotionTrackingOverlay panoramaRef={panoramaRef} onTeleportToMarker={handleTeleportToMarker} />
          <LocationOverlay />
        </>
      )}
    </>
  );
};
