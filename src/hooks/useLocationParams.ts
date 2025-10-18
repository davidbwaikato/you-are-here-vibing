import { useEffect, useState } from 'react';
import { parseLocationParams } from '../utils/urlParams';
import { geocodeLocation, type LatLng } from '../services/geocoding';

interface LocationState {
  isLoading: boolean;
  error: string | null;
  sourceLocation: LatLng | null;
  destinationLocation: LatLng | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  attemptedSourceLocation: string | null;
  hasSourceError: boolean;
}

const DEFAULT_SOURCE_LOCATION: LatLng = {
  lat: 41.9007576,
  lng: 12.4832866,
};

const DEFAULT_DESTINATION_LOCATION: LatLng = {
  lat: 41.9058403,
  lng: 12.4822975,
};

/**
 * Hook to handle URL parameter parsing and geocoding
 */
export const useLocationParams = (isGoogleMapsLoaded: boolean) => {
  const [state, setState] = useState<LocationState>({
    isLoading: false,
    error: null,
    sourceLocation: DEFAULT_SOURCE_LOCATION,
    destinationLocation: DEFAULT_DESTINATION_LOCATION,
    sourceAddress: 'Trevi Fountain, Rome, Italy',
    destinationAddress: 'The Spanish Steps, Rome, Italy',
    attemptedSourceLocation: null,
    hasSourceError: false,
  });

  useEffect(() => {
    console.log('[useLocationParams] Effect triggered - isGoogleMapsLoaded:', isGoogleMapsLoaded);
    
    if (!isGoogleMapsLoaded) {
      console.log('[useLocationParams] Waiting for Google Maps to load');
      return;
    }

    console.log('[useLocationParams] Google Maps is loaded, processing locations...');

    const processLocations = async () => {
      const params = parseLocationParams();
      console.log('[useLocationParams] Processing URL params:', params);
      
      // If no parameters, use default locations
      if (!params.src && !params.dst) {
        console.log('[useLocationParams] No params, using default locations');
        setState({
          isLoading: false,
          error: null,
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: null,
          hasSourceError: false,
        });
        return;
      }

      setState((prev) => ({ 
        ...prev, 
        isLoading: true, 
        error: null,
        attemptedSourceLocation: params.src || null,
        hasSourceError: false,
      }));

      try {
        console.log('[useLocationParams] Starting geocoding...');
        
        // Geocode source (or use default)
        const srcPromise = params.src 
          ? geocodeLocation(params.src) 
          : Promise.resolve({ 
              location: DEFAULT_SOURCE_LOCATION, 
              formattedAddress: 'Trevi Fountain, Rome, Italy' 
            });
        
        // Geocode destination (or use default)
        const dstPromise = params.dst 
          ? geocodeLocation(params.dst) 
          : Promise.resolve({ 
              location: DEFAULT_DESTINATION_LOCATION, 
              formattedAddress: 'The Spanish Steps, Rome, Italy' 
            });

        const results = await Promise.all([srcPromise, dstPromise]);
        const [srcResult, dstResult] = results;
        console.log('[useLocationParams] Geocoding results:', { srcResult, dstResult });

        let newState: LocationState = {
          isLoading: false,
          error: null,
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: params.src || null,
          hasSourceError: false,
        };

        // Process source location
        if (srcResult) {
          if ('error' in srcResult) {
            newState.error = srcResult.error;
            newState.hasSourceError = true;
            console.error('[useLocationParams] Source geocoding failed:', srcResult);
          } else {
            newState.sourceLocation = srcResult.location;
            newState.sourceAddress = srcResult.formattedAddress;
            newState.hasSourceError = false;
            console.log('[useLocationParams] Source geocoded successfully:', srcResult);
          }
        }

        // Process destination location (only if source succeeded or wasn't provided)
        if (dstResult && !newState.hasSourceError) {
          if ('error' in dstResult) {
            console.warn('[useLocationParams] Destination geocoding failed:', dstResult);
            // Don't block the app for destination errors, just log them
          } else {
            newState.destinationLocation = dstResult.location;
            newState.destinationAddress = dstResult.formattedAddress;
            console.log('[useLocationParams] Destination geocoded successfully:', dstResult);
          }
        }

        console.log('[useLocationParams] Final state:', newState);
        setState(newState);
      } catch (error) {
        console.error('[useLocationParams] Geocoding error:', error);
        setState({
          isLoading: false,
          error: 'Failed to process locations',
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: params.src || null,
          hasSourceError: !!params.src,
        });
      }
    };

    processLocations();
  }, [isGoogleMapsLoaded]);

  console.log('[useLocationParams] Returning state:', state);
  return state;
};
