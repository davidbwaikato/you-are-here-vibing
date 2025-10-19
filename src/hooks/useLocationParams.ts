import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { parseLocationParams } from '../utils/urlParams';
import { geocodeLocation, type LatLng } from '../services/geocoding';
import { setPosition, setDestinationLocation, setSourceAddress, setDestinationAddress } from '../store/streetViewSlice';

interface LocationState {
  isInitializing: boolean;
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
  const dispatch = useDispatch();
  const [state, setState] = useState<LocationState>({
    isInitializing: true,
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
      console.log('[useLocationParams] ⏳ Waiting for Google Maps API to load...');
      return;
    }

    console.log('[useLocationParams] ✅ Google Maps API loaded, initializing Geocoder...');

    const processLocations = async () => {
      const params = parseLocationParams();
      console.log('[useLocationParams] 📍 Parsed URL params:', params);
      
      // If no parameters, use default locations and update Redux
      if (!params.src && !params.dst) {
        console.log('[useLocationParams] 📌 No URL params, using default locations');
        const defaultState = {
          isInitializing: false,
          error: null,
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: null,
          hasSourceError: false,
        };
        setState(defaultState);
        
        // Update Redux store with default addresses
        dispatch(setSourceAddress(defaultState.sourceAddress));
        dispatch(setDestinationAddress(defaultState.destinationAddress));
        dispatch(setPosition(DEFAULT_SOURCE_LOCATION));
        dispatch(setDestinationLocation(DEFAULT_DESTINATION_LOCATION));
        console.log('[useLocationParams] ✅ Redux store updated with default addresses');
        console.log('[useLocationParams] ✅ Initialization complete (no geocoding needed)');
        return;
      }

      console.log('[useLocationParams] 🔄 Starting geocoding process...');
      setState((prev) => ({ 
        ...prev, 
        isInitializing: true, 
        error: null,
        attemptedSourceLocation: params.src || null,
        hasSourceError: false,
      }));

      try {
        // Geocode source (or use default)
        if (params.src) {
          console.log('[useLocationParams] 🔍 Geocoding source location:', params.src);
        }
        const srcPromise = params.src 
          ? geocodeLocation(params.src) 
          : Promise.resolve({ 
              location: DEFAULT_SOURCE_LOCATION, 
              formattedAddress: 'Trevi Fountain, Rome, Italy' 
            });
        
        // Geocode destination (or use default)
        if (params.dst) {
          console.log('[useLocationParams] 🔍 Geocoding destination location:', params.dst);
        }
        const dstPromise = params.dst 
          ? geocodeLocation(params.dst) 
          : Promise.resolve({ 
              location: DEFAULT_DESTINATION_LOCATION, 
              formattedAddress: 'The Spanish Steps, Rome, Italy' 
            });

        const results = await Promise.all([srcPromise, dstPromise]);
        const [srcResult, dstResult] = results;
        console.log('[useLocationParams] ✅ Geocoding complete');
        console.log('[useLocationParams] 📍 Source result:', srcResult);
        console.log('[useLocationParams] 📍 Destination result:', dstResult);

        let newState: LocationState = {
          isInitializing: false,
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
            console.error('[useLocationParams] ❌ Source geocoding failed:', srcResult.error);
          } else {
            newState.sourceLocation = srcResult.location;
            newState.sourceAddress = srcResult.formattedAddress;
            newState.hasSourceError = false;
            console.log('[useLocationParams] ✅ Source geocoded:', srcResult.formattedAddress);
            
            // Update Redux store with source location and address
            dispatch(setPosition(srcResult.location));
            dispatch(setSourceAddress(srcResult.formattedAddress));
            console.log('[useLocationParams] ✅ Redux updated with source location');
          }
        }

        // Process destination location (only if source succeeded or wasn't provided)
        if (dstResult && !newState.hasSourceError) {
          if ('error' in dstResult) {
            console.warn('[useLocationParams] ⚠️ Destination geocoding failed:', dstResult.error);
            // Don't block the app for destination errors, just log them
          } else {
            newState.destinationLocation = dstResult.location;
            newState.destinationAddress = dstResult.formattedAddress;
            console.log('[useLocationParams] ✅ Destination geocoded:', dstResult.formattedAddress);
            
            // Update Redux store with destination location and address
            dispatch(setDestinationLocation(dstResult.location));
            dispatch(setDestinationAddress(dstResult.formattedAddress));
            console.log('[useLocationParams] ✅ Redux updated with destination location');
          }
        }

        console.log('[useLocationParams] ✅ All initialization complete, ready to show main app');
        setState(newState);
      } catch (error) {
        console.error('[useLocationParams] ❌ Geocoding error:', error);
        const errorState = {
          isInitializing: false,
          error: 'Failed to process locations',
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: params.src || null,
          hasSourceError: !!params.src,
        };
        setState(errorState);
        
        // Update Redux store with default addresses on error
        if (!params.src) {
          dispatch(setSourceAddress(errorState.sourceAddress));
          dispatch(setPosition(DEFAULT_SOURCE_LOCATION));
        }
        if (!params.dst) {
          dispatch(setDestinationAddress(errorState.destinationAddress));
          dispatch(setDestinationLocation(DEFAULT_DESTINATION_LOCATION));
        }
        console.log('[useLocationParams] ✅ Error handled, ready to show main app');
      }
    };

    processLocations();
  }, [isGoogleMapsLoaded, dispatch]);

  return state;
};
