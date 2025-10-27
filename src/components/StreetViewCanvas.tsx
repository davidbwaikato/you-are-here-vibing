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
  }, [sourceAddress, dispatch]);

  useEffect(() => {
    if (destinationAddress) {
      dispatch(setDestinationAddress(destinationAddress));
    }
  }, [destinationAddress, dispatch]);

  useEffect(() => {
    if (destinationLocation) {
      dispatch(setDestinationLocation(destinationLocation));
    }
  }, [destinationLocation, dispatch]);

  useEffect(() => {
    if (!isGoogleMapsLoaded || !containerRef.current || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    shouldCleanupRef.current = false;

    console.log('[StreetView] 🔍 Initializing panorama with StreetViewService...');
    console.log('[StreetView] 📍 Target position:', position);

    // Use StreetViewService to find nearest panorama and calculate heading
    const streetViewService = new google.maps.StreetViewService();
    
    streetViewService.getPanoramaByLocation(
      new google.maps.LatLng(position.lat, position.lng),
      50, // Search radius in meters
      (streetViewPanoramaData, streetViewStatus) => {
        let panoramaPosition: google.maps.LatLng | google.maps.LatLngLiteral;
        let panoramaPOV: google.maps.StreetViewPov;

        if (streetViewStatus === google.maps.StreetViewStatus.OK && streetViewPanoramaData) {
          // SUCCESS: Found a nearby panorama
          const panoramaCoords = streetViewPanoramaData.location!.latLng!;
          
          console.log('[StreetView] ✅ Panorama found!');
          console.log('[StreetView] 📍 Panorama location:', {
            lat: panoramaCoords.lat(),
            lng: panoramaCoords.lng(),
          });
          console.log('[StreetView] 📍 Target location:', position);

          // Calculate heading from panorama to target location
          const heading = google.maps.geometry.spherical.computeHeading(
            panoramaCoords,
            new google.maps.LatLng(position.lat, position.lng)
          );

          console.log('[StreetView] 🧭 Computed heading:', heading.toFixed(2), '°');

          // Calculate distance offset
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            panoramaCoords,
            new google.maps.LatLng(position.lat, position.lng)
          );

          console.log('[StreetView] 📏 Distance from target:', distance.toFixed(2), 'meters');

          panoramaPosition = panoramaCoords;
          panoramaPOV = {
            heading: heading,
            pitch: 0.00, // Level view
          };

          // Update Redux with actual panorama position and computed heading
          dispatch(setPosition({
            lat: panoramaCoords.lat(),
            lng: panoramaCoords.lng(),
          }));
          
          dispatch(setPov({
            heading: heading,
            pitch: 0.00,
            source: 'initial',
          }));

          console.log('[StreetView] 🎯 Initial POV set (INITIAL):', {
            heading: heading.toFixed(2),
            pitch: '0.00',
            source: 'StreetViewService + computeHeading',
          });
        } else {
          // FALLBACK: No panorama found, use original position and POV
          console.warn('[StreetView] ⚠️ No panorama found within 50m radius');
          console.log('[StreetView] 🔄 Falling back to original position and POV');
          
          panoramaPosition = position;
          panoramaPOV = pov;
        }

        // Initialize the StreetViewPanorama with computed values
        const panorama = new google.maps.StreetViewPanorama(containerRef.current!, {
          position: panoramaPosition,
          pov: panoramaPOV,
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

        console.log('[StreetView] 🎬 Panorama initialized with:', {
          position: panoramaPosition instanceof google.maps.LatLng 
            ? { lat: panoramaPosition.lat(), lng: panoramaPosition.lng() }
            : panoramaPosition,
          pov: panoramaPOV,
          zoom,
        });

        // Set up event listeners
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
            console.log('[StreetView] ✅ Panorama ready and loaded');
          }
        });
      }
    );

    return () => {
      if (shouldCleanupRef.current && panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, [isGoogleMapsLoaded, position, pov, zoom, dispatch]);

  useEffect(() => {
    if (!panoramaRef.current || !isPanoramaReady) return;

    const currentPosition = panoramaRef.current.getPosition();
    const currentLat = currentPosition?.lat();
    const currentLng = currentPosition?.lng();

    if (currentLat === position.lat && currentLng === position.lng) return;

    console.log('[StreetView] 📍 Updating panorama position:', position);
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
