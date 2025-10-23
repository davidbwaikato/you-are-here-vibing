import { useEffect, useRef, useState } from 'react';
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
  const [isInitialized, setIsInitialized] = useState(false);
  
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

    if (isInitialized) {
      console.log('[StreetView] Already initialized, skipping...');
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
    setIsInitialized(true);
    console.log('[StreetView] ✅ Panorama created');

    // Listen for panorama status changes
    panorama.addListener('status_changed', () => {
      const status = panorama.getStatus();
      console.log('[StreetView] 📊 Status changed:', status);
      
      if (status === 'OK') {
        console.log('[StreetView] ✅ Panorama loaded successfully');
        dispatch(setLoaded(true));
      } else if (status === 'ZERO_RESULTS') {
        console.error('[StreetView] ❌ No Street View available at this location');
        dispatch(setLoaded(false));
      } else if (status === 'UNKNOWN_ERROR') {
        console.error('[StreetView] ❌ Unknown error loading Street View');
        dispatch(setLoaded(false));
      }
    });

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

    // Mark as loaded initially
    dispatch(setLoaded(true));
    console.log('[StreetView] ✅ Street View initialization complete');

    return () => {
      console.log('[StreetView] 🧹 Cleaning up Street View...');
      panoramaRef.current = null;
      setIsInitialized(false);
    };
  }, [isReady, dispatch, isInitialized]);

  // Update panorama when Redux state changes (from external sources like teleport)
  useEffect(() => {
    if (!panoramaRef.current || !isInitialized) {
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
      
      // Create a StreetViewService to check if Street View is available
      const streetViewService = new google.maps.StreetViewService();
      const SEARCH_RADIUS = 50; // meters
      
      console.log('[StreetView] 🔍 Checking Street View availability at target location...');
      
      streetViewService.getPanorama(
        {
          location: position,
          radius: SEARCH_RADIUS,
          source: google.maps.StreetViewSource.OUTDOOR,
        },
        (data, status) => {
          if (status === 'OK' && data && data.location) {
            const nearestLocation = data.location.latLng;
            
            if (nearestLocation) {
              const nearestLat = nearestLocation.lat();
              const nearestLng = nearestLocation.lng();
              
              console.log('[StreetView] ✅ Street View available:', {
                requested: position,
                nearest: { lat: nearestLat, lng: nearestLng },
                panoId: data.location.pano,
              });
              
              // Update the panorama to the nearest available location
              if (panoramaRef.current) {
                panoramaRef.current.setPano(data.location.pano!);
                panoramaRef.current.setPov(pov);
                panoramaRef.current.setZoom(zoom);
                
                console.log('[StreetView] 🎯 Panorama updated to nearest location');
              }
            }
          } else {
            console.error('[StreetView] ❌ No Street View available near target location:', {
              status,
              position,
              searchRadius: SEARCH_RADIUS,
            });
            
            // Fallback: Try to set position directly anyway
            console.log('[StreetView] 🔄 Attempting direct position update as fallback...');
            if (panoramaRef.current) {
              panoramaRef.current.setPosition(position);
              panoramaRef.current.setPov(pov);
              panoramaRef.current.setZoom(zoom);
            }
          }
        }
      );
    }
  }, [position, pov, zoom, isInitialized]);

  useEffect(() => {
    if (!panoramaRef.current || !isInitialized) {
      console.log('[StreetView] ⚠️ Cannot update POV - panorama not initialized');
      return;
    }

    const currentPov = panoramaRef.current.getPov();
    if (Math.abs(currentPov.heading - pov.heading) > 0.1 ||
        Math.abs(currentPov.pitch - pov.pitch) > 0.1) {
      console.log('[StreetView] 🔄 Updating POV from Redux:', pov);
      panoramaRef.current.setPov(pov);
    }
  }, [pov, isInitialized]);

  useEffect(() => {
    if (!panoramaRef.current || !isInitialized) return;

    const currentZoom = panoramaRef.current.getZoom();
    if (Math.abs(currentZoom - zoom) > 0.01) {
      console.log('[StreetView] 🔄 Updating zoom from Redux:', zoom);
      panoramaRef.current.setZoom(zoom);
    }
  }, [zoom, isInitialized]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
};
