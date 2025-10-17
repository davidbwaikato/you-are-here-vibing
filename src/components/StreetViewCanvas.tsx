import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setPosition, setPov, setZoom, setLoaded, setDestinationLocation, setSourceAddress, setDestinationAddress } from '../store/streetViewSlice';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { useLocationParams } from '../hooks/useLocationParams';
import { MotionTrackingOverlay } from './MotionTrackingOverlay';
import { LocationErrorPage } from './LocationErrorPage';
import { SplashScreen } from './SplashScreen';
import { INITIAL_HEADING, INITIAL_PITCH } from '../utils/constants';

export const StreetViewCanvas = () => {
  const dispatch = useDispatch();
  const { position, pov, zoom, isVideoOverlayEnabled } = useSelector((state: RootState) => state.streetView);
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const { isLoaded: isGoogleMapsLoaded, loadError } = useGoogleMaps();
  const locationState = useLocationParams(isGoogleMapsLoaded);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  // Determine if we're still loading
  const isLoading = !isGoogleMapsLoaded || locationState.isLoading;

  // Handle splash screen transition
  const handleSplashTransitionComplete = () => {
    setShowSplash(false);
  };

  // Handle going to default location
  const handleGoToDefault = () => {
    // Remove src parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('src');
    window.location.href = url.toString();
  };

  // Initialize Street View when conditions are met
  useEffect(() => {
    // Don't initialize if splash is still showing
    if (showSplash) {
      return;
    }

    // Don't initialize if Google Maps isn't loaded
    if (!isGoogleMapsLoaded) {
      return;
    }

    // Don't initialize if container isn't ready
    if (!containerRef.current) {
      return;
    }

    // Don't initialize if location is still loading
    if (locationState.isLoading) {
      return;
    }

    // Don't initialize if there's a source location error
    if (locationState.hasSourceError) {
      return;
    }

    // Don't re-initialize if already created
    if (panoramaRef.current) {
      return;
    }

    // Use the geocoded source location or default
    const initialPosition = locationState.sourceLocation || position;

    try {
      const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
        position: initialPosition,
        pov: {
          heading: INITIAL_HEADING,
          pitch: INITIAL_PITCH,
        },
        zoom: zoom,
        addressControl: false,
        linksControl: true,
        panControl: false,
        enableCloseButton: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        zoomControl: false,
        visible: true,
      });

      panoramaRef.current = panorama;

      // Update Redux store with initial values
      dispatch(setPosition(initialPosition));
      dispatch(setPov({ heading: INITIAL_HEADING, pitch: INITIAL_PITCH }));
      dispatch(setSourceAddress(locationState.sourceAddress));
      dispatch(setDestinationLocation(locationState.destinationLocation));
      dispatch(setDestinationAddress(locationState.destinationAddress));
      dispatch(setLoaded(true));

      // Listen for position changes
      panorama.addListener('position_changed', () => {
        const newPosition = panorama.getPosition();
        if (newPosition) {
          const pos = {
            lat: newPosition.lat(),
            lng: newPosition.lng(),
          };
          dispatch(setPosition(pos));
        }
      });

      // Listen for POV changes
      panorama.addListener('pov_changed', () => {
        const newPov = panorama.getPov();
        if (newPov) {
          dispatch(setPov({ heading: newPov.heading, pitch: newPov.pitch }));
        }
      });

      // Listen for zoom changes
      panorama.addListener('zoom_changed', () => {
        const newZoom = panorama.getZoom();
        if (newZoom !== undefined) {
          dispatch(setZoom(newZoom));
        }
      });
    } catch (error) {
      console.error('[StreetViewCanvas] Error initialising Street View:', error);
      setInitializationError('Failed to initialise Street View');
    }

    return () => {
      if (panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, [
    showSplash,
    isGoogleMapsLoaded,
    locationState.isLoading,
    locationState.sourceLocation,
    locationState.hasSourceError,
    locationState.sourceAddress,
    locationState.destinationLocation,
    locationState.destinationAddress,
    dispatch,
    position,
    zoom,
  ]);

  // Update panorama when position changes externally
  useEffect(() => {
    if (panoramaRef.current && position) {
      const currentPos = panoramaRef.current.getPosition();
      if (
        !currentPos ||
        Math.abs(currentPos.lat() - position.lat) > 0.00001 ||
        Math.abs(currentPos.lng() - position.lng) > 0.00001
      ) {
        panoramaRef.current.setPosition(position);
      }
    }
  }, [position]);

  // Update panorama when POV changes externally
  useEffect(() => {
    if (panoramaRef.current && pov) {
      const currentPov = panoramaRef.current.getPov();
      if (
        Math.abs(currentPov.heading - pov.heading) > 0.1 ||
        Math.abs(currentPov.pitch - pov.pitch) > 0.1
      ) {
        panoramaRef.current.setPov(pov);
      }
    }
  }, [pov]);

  // Show splash screen while loading
  if (showSplash) {
    return (
      <SplashScreen 
        isLoading={isLoading} 
        onTransitionComplete={handleSplashTransitionComplete}
      />
    );
  }

  // Show error page for source location geocoding failures
  if (locationState.hasSourceError && locationState.attemptedSourceLocation) {
    return (
      <LocationErrorPage
        attemptedLocation={locationState.attemptedSourceLocation}
        errorMessage={locationState.error || 'Unknown error'}
        onGoToDefault={handleGoToDefault}
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center p-8">
          <h2 className="text-2xl font-light text-slate-900 mb-4">Error Loading Google Maps</h2>
          <p className="text-slate-600 font-light">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center p-8">
          <h2 className="text-2xl font-light text-slate-900 mb-4">Initialisation Error</h2>
          <p className="text-slate-600 font-light mb-6">{initializationError}</p>
          <button
            onClick={handleGoToDefault}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            Go to Default Location
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      {isVideoOverlayEnabled && (
        <div style={{ zIndex: 10 }}>
          <MotionTrackingOverlay panoramaRef={panoramaRef} />
        </div>
      )}
      
      {/* Location Info Overlay - Bottom Left */}
      {locationState.sourceAddress && (
        <div 
          className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 px-3 py-2 whitespace-nowrap" 
          style={{ 
            position: 'fixed',
            bottom: '4px',
            left: '24px',
            zIndex: 50,
            pointerEvents: 'auto',
            maxWidth: 'fit-content'
          }}
        >
          <div className="text-sm font-light text-slate-900">
            <span className="font-medium">Current:</span> {locationState.sourceAddress}
          </div>
        </div>
      )}
    </div>
  );
};
