import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded } from '@/store/streetViewSlice';

interface StreetViewProps {
  isReady: boolean;
}

export const StreetView = ({ isReady }: StreetViewProps) => {
  const dispatch = useDispatch();
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);

  // Throttle state for position updates
  const lastPositionUpdateRef = useRef<number>(0);
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const POSITION_UPDATE_THROTTLE_MS = 100; // Throttle position updates to max 10 per second

  // Throttle state for POV updates
  const lastPovUpdateRef = useRef<number>(0);
  const povUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const POV_UPDATE_THROTTLE_MS = 50; // Throttle POV updates to max 20 per second

  // Throttle state for zoom updates
  const lastZoomUpdateRef = useRef<number>(0);
  const zoomUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ZOOM_UPDATE_THROTTLE_MS = 100; // Throttle zoom updates to max 10 per second

  useEffect(() => {
    if (!isReady || !containerRef.current || !window.google) {
      console.log('[StreetView] Not ready to initialize:', { 
        isReady, 
        hasContainer: !!containerRef.current,
        hasGoogle: !!window.google 
      });
      return;
    }

    console.log('[StreetView] 🗺️ Initializing Street View panorama...');

    const panorama = new google.maps.StreetViewPanorama(
      containerRef.current,
      {
        position,
        pov,
        zoom,
        addressControl: false,
        linksControl: true,
        panControl: true,
        enableCloseButton: false,
        zoomControl: true,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
      }
    );

    panoramaRef.current = panorama;
    console.log('[StreetView] ✅ Panorama created');

    // Listen for position changes with throttling
    panorama.addListener('position_changed', () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastPositionUpdateRef.current;

      if (timeSinceLastUpdate < POSITION_UPDATE_THROTTLE_MS) {
        // Throttle: Schedule update for later
        if (positionUpdateTimeoutRef.current) {
          clearTimeout(positionUpdateTimeoutRef.current);
        }

        positionUpdateTimeoutRef.current = setTimeout(() => {
          const newPosition = panorama.getPosition();
          if (newPosition) {
            const lat = newPosition.lat();
            const lng = newPosition.lng();
            console.log('[StreetView] 📍 Position changed (throttled):', { lat, lng });
            dispatch(setPosition({ lat, lng }));
            lastPositionUpdateRef.current = Date.now();
          }
        }, POSITION_UPDATE_THROTTLE_MS - timeSinceLastUpdate);
      } else {
        // Not throttled: Update immediately
        const newPosition = panorama.getPosition();
        if (newPosition) {
          const lat = newPosition.lat();
          const lng = newPosition.lng();
          console.log('[StreetView] 📍 Position changed (immediate):', { lat, lng });
          dispatch(setPosition({ lat, lng }));
          lastPositionUpdateRef.current = now;
        }
      }
    });

    // Listen for POV changes (heading and pitch) with throttling
    panorama.addListener('pov_changed', () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastPovUpdateRef.current;

      if (timeSinceLastUpdate < POV_UPDATE_THROTTLE_MS) {
        // Throttle: Schedule update for later
        if (povUpdateTimeoutRef.current) {
          clearTimeout(povUpdateTimeoutRef.current);
        }

        povUpdateTimeoutRef.current = setTimeout(() => {
          const newPov = panorama.getPov();
          console.log('[StreetView] 👁️ POV changed (throttled):', newPov);
          dispatch(setPov({ 
            heading: newPov.heading, 
            pitch: newPov.pitch 
          }));
          lastPovUpdateRef.current = Date.now();
        }, POV_UPDATE_THROTTLE_MS - timeSinceLastUpdate);
      } else {
        // Not throttled: Update immediately
        const newPov = panorama.getPov();
        console.log('[StreetView] 👁️ POV changed (immediate):', newPov);
        dispatch(setPov({ 
          heading: newPov.heading, 
          pitch: newPov.pitch 
        }));
        lastPovUpdateRef.current = now;
      }
    });

    // Listen for zoom changes with throttling
    panorama.addListener('zoom_changed', () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastZoomUpdateRef.current;

      if (timeSinceLastUpdate < ZOOM_UPDATE_THROTTLE_MS) {
        // Throttle: Schedule update for later
        if (zoomUpdateTimeoutRef.current) {
          clearTimeout(zoomUpdateTimeoutRef.current);
        }

        zoomUpdateTimeoutRef.current = setTimeout(() => {
          const newZoom = panorama.getZoom();
          console.log('[StreetView] 🔍 Zoom changed (throttled):', newZoom);
          dispatch(setZoom(newZoom));
          lastZoomUpdateRef.current = Date.now();
        }, ZOOM_UPDATE_THROTTLE_MS - timeSinceLastUpdate);
      } else {
        // Not throttled: Update immediately
        const newZoom = panorama.getZoom();
        console.log('[StreetView] 🔍 Zoom changed (immediate):', newZoom);
        dispatch(setZoom(newZoom));
        lastZoomUpdateRef.current = now;
      }
    });

    // Mark as loaded
    dispatch(setLoaded(true));
    console.log('[StreetView] ✅ Street View initialization complete with throttled listeners');

    return () => {
      console.log('[StreetView] 🧹 Cleaning up Street View...');
      
      // Clear any pending throttled updates
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
      if (povUpdateTimeoutRef.current) {
        clearTimeout(povUpdateTimeoutRef.current);
      }
      if (zoomUpdateTimeoutRef.current) {
        clearTimeout(zoomUpdateTimeoutRef.current);
      }
      
      panoramaRef.current = null;
    };
  }, [isReady, dispatch]);

  // Update panorama when Redux state changes (from external sources like teleport)
  // with additional safeguards to prevent infinite loops
  useEffect(() => {
    if (!panoramaRef.current) {
      console.log('[StreetView] ⚠️ Cannot update position - panorama not initialized');
      return;
    }

    const currentPosition = panoramaRef.current.getPosition();
    
    // Check if position actually changed (avoid infinite loops)
    if (currentPosition && 
        (Math.abs(currentPosition.lat() - position.lat) > 0.00001 ||
         Math.abs(currentPosition.lng() - position.lng) > 0.00001)) {
      console.log('[StreetView] 🚀 UPDATING PANORAMA POSITION:', {
        from: { lat: currentPosition.lat(), lng: currentPosition.lng() },
        to: position,
      });
      
      // Update the panorama position
      panoramaRef.current.setPosition(position);
    }
  }, [position]);

  useEffect(() => {
    if (!panoramaRef.current) {
      console.log('[StreetView] ⚠️ Cannot update POV - panorama not initialized');
      return;
    }

    const currentPov = panoramaRef.current.getPov();
    if (Math.abs(currentPov.heading - pov.heading) > 0.1 ||
        Math.abs(currentPov.pitch - pov.pitch) > 0.1) {
      console.log('[StreetView] 🔄 Updating POV from Redux:', pov);
      panoramaRef.current.setPov(pov);
    }
  }, [pov]);

  useEffect(() => {
    if (!panoramaRef.current) return;

    const currentZoom = panoramaRef.current.getZoom();
    if (Math.abs(currentZoom - zoom) > 0.01) {
      console.log('[StreetView] 🔄 Updating zoom from Redux:', zoom);
      panoramaRef.current.setZoom(zoom);
    }
  }, [zoom]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
};
