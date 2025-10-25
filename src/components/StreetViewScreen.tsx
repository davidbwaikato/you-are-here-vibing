import { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setPosition, setPov, setZoom, setLoaded } from '@/store/streetViewSlice';
import { LocationOverlay } from './LocationOverlay';
import { usePositionGeocoding } from '@/hooks/usePositionGeocoding';

export const StreetViewScreen = () => {
  const dispatch = useDispatch();
  const { position, pov, zoom } = useSelector((state: RootState) => state.streetView);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Enable position-triggered geocoding
  usePositionGeocoding();

  useEffect(() => {
    console.log('[StreetViewScreen] 🚀 Initializing Street View...');
    console.log('[StreetViewScreen] 📍 Initial position:', position);
    console.log('[StreetViewScreen] 👁️ Initial POV:', pov);
    console.log('[StreetViewScreen] 🔍 Initial zoom:', zoom);

    if (!containerRef.current) {
      console.error('[StreetViewScreen] ❌ Container ref not available');
      return;
    }

    if (!window.google || !window.google.maps) {
      console.error('[StreetViewScreen] ❌ Google Maps not loaded');
      setError('Google Maps not loaded');
      return;
    }

    try {
      console.log('[StreetViewScreen] 🔧 Creating StreetViewPanorama instance...');
      
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
      });

      panoramaRef.current = panorama;
      console.log('[StreetViewScreen] ✅ StreetViewPanorama created successfully');

      // Listen for position changes
      panorama.addListener('position_changed', () => {
        const newPosition = panorama.getPosition();
        if (newPosition) {
          const pos = {
            lat: newPosition.lat(),
            lng: newPosition.lng(),
          };
          console.log('[StreetViewScreen] 📍 Position changed:', pos);
          dispatch(setPosition(pos));
        }
      });

      // Listen for POV changes
      panorama.addListener('pov_changed', () => {
        const newPov = panorama.getPov();
        console.log('[StreetViewScreen] 👁️ POV changed:', newPov);
        dispatch(setPov(newPov));
      });

      // Listen for zoom changes
      panorama.addListener('zoom_changed', () => {
        const newZoom = panorama.getZoom();
        console.log('[StreetViewScreen] 🔍 Zoom changed:', newZoom);
        dispatch(setZoom(newZoom));
      });

      // Mark as loaded when panorama is ready
      panorama.addListener('status_changed', () => {
        const status = panorama.getStatus();
        console.log('[StreetViewScreen] 📊 Status changed:', status);
        
        if (status === 'OK') {
          console.log('[StreetViewScreen] ✅ Street View loaded successfully');
          dispatch(setLoaded(true));
          setError(null);
        } else {
          console.error('[StreetViewScreen] ❌ Street View failed to load:', status);
          setError(`Failed to load Street View: ${status}`);
          dispatch(setLoaded(false));
        }
      });

      console.log('[StreetViewScreen] 🎧 Event listeners attached');
    } catch (err) {
      console.error('[StreetViewScreen] ❌ Error initializing Street View:', err);
      setError('Failed to initialize Street View');
    }

    return () => {
      console.log('[StreetViewScreen] 🧹 Cleaning up Street View...');
      if (panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, []); // Only run once on mount

  // Update panorama when Redux state changes (from external sources)
  useEffect(() => {
    if (!panoramaRef.current) return;

    const currentPosition = panoramaRef.current.getPosition();
    if (currentPosition) {
      const currentLat = currentPosition.lat();
      const currentLng = currentPosition.lng();

      // Only update if position actually changed (avoid infinite loops)
      if (Math.abs(currentLat - position.lat) > 0.00001 || 
          Math.abs(currentLng - position.lng) > 0.00001) {
        console.log('[StreetViewScreen] 🔄 Updating panorama position from Redux:', position);
        panoramaRef.current.setPosition(position);
      }
    }
  }, [position]);

  useEffect(() => {
    if (!panoramaRef.current) return;

    const currentPov = panoramaRef.current.getPov();
    
    // Only update if POV actually changed
    if (Math.abs(currentPov.heading - pov.heading) > 0.1 || 
        Math.abs(currentPov.pitch - pov.pitch) > 0.1) {
      console.log('[StreetViewScreen] 🔄 Updating panorama POV from Redux:', pov);
      panoramaRef.current.setPov(pov);
    }
  }, [pov]);

  useEffect(() => {
    if (!panoramaRef.current) return;

    const currentZoom = panoramaRef.current.getZoom();
    
    // Only update if zoom actually changed
    if (Math.abs(currentZoom - zoom) > 0.1) {
      console.log('[StreetViewScreen] 🔄 Updating panorama zoom from Redux:', zoom);
      panoramaRef.current.setZoom(zoom);
    }
  }, [zoom]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Street View Error</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />
      <LocationOverlay />
    </div>
  );
};
