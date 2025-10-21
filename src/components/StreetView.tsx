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

    // Listen for position changes
    panorama.addListener('position_changed', () => {
      const newPosition = panorama.getPosition();
      if (newPosition) {
        const lat = newPosition.lat();
        const lng = newPosition.lng();
        console.log('[StreetView] 📍 Position changed:', { lat, lng });
        dispatch(setPosition({ lat, lng }));
      }
    });

    // Listen for POV changes (heading and pitch)
    panorama.addListener('pov_changed', () => {
      const newPov = panorama.getPov();
      console.log('[StreetView] 👁️ POV changed:', newPov);
      dispatch(setPov({ 
        heading: newPov.heading, 
        pitch: newPov.pitch 
      }));
    });

    // Listen for zoom changes
    panorama.addListener('zoom_changed', () => {
      const newZoom = panorama.getZoom();
      console.log('[StreetView] 🔍 Zoom changed:', newZoom);
      dispatch(setZoom(newZoom));
    });

    // Mark as loaded
    dispatch(setLoaded(true));
    console.log('[StreetView] ✅ Street View initialization complete');

    return () => {
      console.log('[StreetView] 🧹 Cleaning up Street View...');
      panoramaRef.current = null;
    };
  }, [isReady, dispatch]);

  // Update panorama when Redux state changes (from external sources like teleport)
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
