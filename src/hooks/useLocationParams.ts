import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { parseLocationParams } from '../utils/urlParams';
import { geocodeLocation, type LatLng } from '../services/geocoding';
import { fetchWalkingRoute, type RouteResult } from '../services/routing';
import { fetchPlaceDetails } from '../services/places';
import { setPosition, setSourceLocation, setDestinationLocation, setSourceAddress, setDestinationAddress, setSourceDetails, setDestinationDetails, setRoutePolyline } from '../store/streetViewSlice';

interface LocationState {
  isInitializing: boolean;
  error: string | null;
  sourceLocation: LatLng | null;
  destinationLocation: LatLng | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  attemptedSourceLocation: string | null;
  hasSourceError: boolean;
  route: RouteResult | null;
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
 * Hook to handle URL parameter parsing, geocoding, place details fetching, and route calculation
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
    route: null,
  });

  useEffect(() => {
    console.log('[useLocationParams] Effect triggered - isGoogleMapsLoaded:', isGoogleMapsLoaded);
    
    if (!isGoogleMapsLoaded) {
      console.log('[useLocationParams] ⏳ Waiting for Google Maps API to load...');
      return;
    }

    console.log('[useLocationParams] ✅ Google Maps API loaded, initializing...');

    const processLocations = async () => {
      const params = parseLocationParams();
      console.log('[useLocationParams] 📍 Parsed URL params:', params);
      
      // Get API key from environment
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('[useLocationParams] ❌ Google Maps API key not found');
        setState((prev) => ({
          ...prev,
          isInitializing: false,
          error: 'Google Maps API key not configured',
        }));
        return;
      }

      // If no parameters, use default locations and calculate route
      if (!params.src && !params.dst) {
        console.log('[useLocationParams] 📌 No URL params, using default locations');
        
        // Fetch place details for default locations
        console.log('[useLocationParams] 🏛️ Fetching place details for default locations...');
        const [sourceDetailsResult, destinationDetailsResult] = await Promise.all([
          fetchPlaceDetails(DEFAULT_SOURCE_LOCATION),
          fetchPlaceDetails(DEFAULT_DESTINATION_LOCATION),
        ]);

        // Update Redux with place details
        if ('details' in sourceDetailsResult) {
          console.log('[useLocationParams] ✅ Source place details retrieved:', sourceDetailsResult.details);
          dispatch(setSourceDetails(sourceDetailsResult.details));
        } else {
          console.warn('[useLocationParams] ⚠️ Failed to fetch source place details:', sourceDetailsResult.error);
          dispatch(setSourceDetails(null));
        }

        if ('details' in destinationDetailsResult) {
          console.log('[useLocationParams] ✅ Destination place details retrieved:', destinationDetailsResult.details);
          dispatch(setDestinationDetails(destinationDetailsResult.details));
        } else {
          console.warn('[useLocationParams] ⚠️ Failed to fetch destination place details:', destinationDetailsResult.error);
          dispatch(setDestinationDetails(null));
        }
        
        // Calculate route with default locations
        console.log('[useLocationParams] 🚶 Calculating default route...');
        const routeResult = await fetchWalkingRoute(
          DEFAULT_SOURCE_LOCATION,
          DEFAULT_DESTINATION_LOCATION,
          apiKey
        );

        const defaultState = {
          isInitializing: false,
          error: 'error' in routeResult ? routeResult.error : null,
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: null,
          hasSourceError: false,
          route: 'error' in routeResult ? null : routeResult,
        };
        setState(defaultState);
        
        // Update Redux store with default addresses and locations
        dispatch(setSourceAddress(defaultState.sourceAddress));
        dispatch(setSourceLocation(DEFAULT_SOURCE_LOCATION));
        dispatch(setDestinationAddress(defaultState.destinationAddress));
        dispatch(setPosition(DEFAULT_SOURCE_LOCATION));
        dispatch(setDestinationLocation(DEFAULT_DESTINATION_LOCATION));
        if (!('error' in routeResult)) {
          dispatch(setRoutePolyline(routeResult.decodedPolyline));
        }
        console.log('[useLocationParams] ✅ Redux store updated with default addresses, locations, place details, and route');
        console.log('[useLocationParams] ✅ Initialization complete');
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
          route: null,
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
            dispatch(setSourceLocation(srcResult.location));
            dispatch(setSourceAddress(srcResult.formattedAddress));
            console.log('[useLocationParams] ✅ Redux updated with source location');

            // Fetch place details for source location
            console.log('[useLocationParams] 🏛️ Fetching place details for source location...');
            const sourceDetailsResult = await fetchPlaceDetails(srcResult.location);
            if ('details' in sourceDetailsResult) {
              console.log('[useLocationParams] ✅ Source place details retrieved:', sourceDetailsResult.details);
              dispatch(setSourceDetails(sourceDetailsResult.details));
            } else {
              console.warn('[useLocationParams] ⚠️ Failed to fetch source place details:', sourceDetailsResult.error);
              dispatch(setSourceDetails(null));
            }
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

            // Fetch place details for destination location
            console.log('[useLocationParams] 🏛️ Fetching place details for destination location...');
            const destinationDetailsResult = await fetchPlaceDetails(dstResult.location);
            if ('details' in destinationDetailsResult) {
              console.log('[useLocationParams] ✅ Destination place details retrieved:', destinationDetailsResult.details);
              dispatch(setDestinationDetails(destinationDetailsResult.details));
            } else {
              console.warn('[useLocationParams] ⚠️ Failed to fetch destination place details:', destinationDetailsResult.error);
              dispatch(setDestinationDetails(null));
            }
          }
        }

        // Calculate route if both locations are valid
        if (newState.sourceLocation && newState.destinationLocation && !newState.hasSourceError) {
          console.log('[useLocationParams] 🚶 Calculating walking route...');
          const routeResult = await fetchWalkingRoute(
            newState.sourceLocation,
            newState.destinationLocation,
            apiKey
          );

          if ('error' in routeResult) {
            console.error('[useLocationParams] ❌ Route calculation failed:', routeResult.error);
            newState.error = routeResult.error;
          } else {
            console.log('[useLocationParams] ✅ Route calculated successfully');
            newState.route = routeResult;
            dispatch(setRoutePolyline(routeResult.decodedPolyline));
          }
        }

        console.log('[useLocationParams] ✅ All initialization complete (including place details), ready to show main app');
        setState(newState);
      } catch (error) {
        console.error('[useLocationParams] ❌ Initialization error:', error);
        const errorState = {
          isInitializing: false,
          error: 'Failed to process locations',
          sourceLocation: DEFAULT_SOURCE_LOCATION,
          destinationLocation: DEFAULT_DESTINATION_LOCATION,
          sourceAddress: 'Trevi Fountain, Rome, Italy',
          destinationAddress: 'The Spanish Steps, Rome, Italy',
          attemptedSourceLocation: params.src || null,
          hasSourceError: !!params.src,
          route: null,
        };
        setState(errorState);
        
        // Update Redux store with default addresses and locations on error
        if (!params.src) {
          dispatch(setSourceAddress(errorState.sourceAddress));
          dispatch(setSourceLocation(DEFAULT_SOURCE_LOCATION));
          dispatch(setPosition(DEFAULT_SOURCE_LOCATION));
          dispatch(setSourceDetails(null));
        }
        if (!params.dst) {
          dispatch(setDestinationAddress(errorState.destinationAddress));
          dispatch(setDestinationLocation(DEFAULT_DESTINATION_LOCATION));
          dispatch(setDestinationDetails(null));
        }
        console.log('[useLocationParams] ✅ Error handled, ready to show main app');
      }
    };

    processLocations();
  }, [isGoogleMapsLoaded, dispatch]);

  return state;
};
