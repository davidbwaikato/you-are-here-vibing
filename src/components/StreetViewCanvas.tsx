import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded, setDestinationLocation, setSourceAddress, setDestinationAddress } from '@/store/streetViewSlice';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { LocationOverlay } from './LocationOverlay';
import { ThreeJsCanvas } from './ThreeJsCanvas';
import { usePositionGeocoding } from '@/hooks/usePositionGeocoding';


import {
  findGoodPanorama,
  getPanoramaByLocationAsync,
  ringBearings,
  generateRingSamples,
} from '@/utils/panoramaHelper';






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

  (async () => {
    console.log('[StreetView] 🔍 Initializing panorama with selective search...');
    console.log('[StreetView] 📍 Target position:', position);

    const streetViewService = new google.maps.StreetViewService();
    const targetLatLng = new google.maps.LatLng(position.lat, position.lng);

    // 1) Find a "good" panorama (>=2 links) nearest to target; fallback to naive nearest
    const goodPano = await findGoodPanorama(streetViewService, targetLatLng, {
      radii: [0, 25, 50, 75, 100, 150, 200],
      segmentsPerRing: [1, 8, 8, 12, 12, 16, 16],
      panoLookupRadius: 50,
      minLinks: 2,
      maxPerBatch: 16,
    });

    let panoramaPosition: google.maps.LatLng | google.maps.LatLngLiteral;
    let panoramaPOV: google.maps.StreetViewPov;

    if (goodPano && goodPano.location?.latLng) {
      const panoLatLng = goodPano.location.latLng;
      console.log('[StreetView] ✅ Selected panorama:', {
        lat: panoLatLng.lat(),
        lng: panoLatLng.lng(),
        links: goodPano.links?.length ?? 0,
        description: goodPano.location?.description,
        copyright: goodPano.copyright,
      });

      // 2) Compute heading from chosen pano to the intended target
      const heading = google.maps.geometry.spherical.computeHeading(
        panoLatLng,
        targetLatLng
      );

      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        panoLatLng,
        targetLatLng
      );

      console.log('[StreetView] 🧭 Heading:', heading.toFixed(2), '°');
      console.log('[StreetView] 📏 Distance:', distance.toFixed(1), 'm');

      panoramaPosition = panoLatLng;
      panoramaPOV = { heading, pitch: 0.0 };

      // Store the **actual** pano coords + POV we’ll use
      dispatch(setPosition({ lat: panoLatLng.lat(), lng: panoLatLng.lng() }));
      dispatch(setPov({ heading, pitch: 0.0, source: 'initial' }));
    } else {
      console.warn('[StreetView] ⚠️ No panorama found by selective search; falling back');
      panoramaPosition = position;
      panoramaPOV = pov;
    }

    // 3) Initialize the StreetViewPanorama
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
      console.log("[StreetView] **** adding in panorama and panoramaHTML into 'window'");
      window.panorama = panorama;
      window.panoramaHTML = containerRef.current;
      
    console.log('[StreetView] 🎬 Panorama initialized with:', {
      position: panoramaPosition instanceof google.maps.LatLng
        ? { lat: panoramaPosition.lat(), lng: panoramaPosition.lng() }
        : panoramaPosition,
      pov: panoramaPOV,
      zoom,
    });

    // 4) Event listeners (unchanged)
    panorama.addListener('position_changed', () => {
      const newPosition = panorama.getPosition();
      if (newPosition) {
        dispatch(setPosition({ lat: newPosition.lat(), lng: newPosition.lng() }));
      }
    });

    panorama.addListener('pov_changed', () => {
      if (isUpdatingPovRef.current) return;
      const newPov = panorama.getPov();
      console.log('[StreetView] 🖱️ POV changed by MOUSE:', {
        heading: newPov.heading.toFixed(2),
        pitch: newPov.pitch.toFixed(2),
      });
      dispatch(setPov({ heading: newPov.heading, pitch: newPov.pitch, source: 'mouse' }));
    });

    panorama.addListener('zoom_changed', () => {
      dispatch(setZoom(panorama.getZoom()));
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
  })();

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
/*
  useEffect(() => {
    if (!panoramaRef.current || !sourceLocation || hasSourceError || !isPanoramaReady) return;
    console.log('[StreetView] 🚀 Teleporting to source location (TELEPORT)');
    panoramaRef.current.setPosition(sourceLocation);
  }, [sourceLocation, hasSourceError, isPanoramaReady]);
*/
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
