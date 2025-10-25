import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  setSourceLocation,
  setDestinationLocation,
  setSourceAddress,
  setDestinationAddress,
  setSourceDetails,
  setDestinationDetails,
} from '../store/streetViewSlice';

interface LocationError {
  attemptedLocation: string;
  errorMessage: string;
}

interface UseLocationParamsResult {
  error: string | null;
  sourceError: LocationError | null;
  destinationError: LocationError | null;
  sourceRecognized: boolean;
  destinationRecognized: boolean;
  isInitializing: boolean;
  sourceLocation: { lat: number; lng: number } | null;
  destinationLocation: { lat: number; lng: number } | null;
  sourceAddress: string;
  destinationAddress: string;
}

/**
 * Hook to parse and validate location parameters from URL
 * PHASE 2 ONLY: Parse and validate locations, NO OpenAI calls
 */
export const useLocationParams = (isGoogleMapsLoaded: boolean): UseLocationParamsResult => {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<LocationError | null>(null);
  const [destinationError, setDestinationError] = useState<LocationError | null>(null);
  const [sourceRecognized, setSourceRecognized] = useState(false);
  const [destinationRecognized, setDestinationRecognized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sourceLocation, setSourceLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [sourceAddress, setSourceAddressState] = useState('');
  const [destinationAddress, setDestinationAddressState] = useState('');

  useEffect(() => {
    if (!isGoogleMapsLoaded) {
      console.log('[useLocationParams] ⏳ Waiting for Google Maps to load...');
      return;
    }

    console.log('[useLocationParams] 🚀 PHASE 2: Parsing location parameters (NO OpenAI calls)');

    const urlParams = new URLSearchParams(window.location.search);
    const srcParam = urlParams.get('src');
    const dstParam = urlParams.get('dst');

    console.log('[useLocationParams] 📍 URL params:', { srcParam, dstParam });

    // If no parameters, use defaults
    if (!srcParam || !dstParam) {
      console.log('[useLocationParams] ℹ️ No URL params, using defaults');
      const defaultSource = { lat: 41.9007576, lng: 12.4832866 };
      const defaultDestination = { lat: 41.9058403, lng: 12.4822975 };
      
      setSourceLocationState(defaultSource);
      setDestinationLocationState(defaultDestination);
      setSourceAddressState('Trevi Fountain, Rome, Italy');
      setDestinationAddressState('Spanish Steps, Rome, Italy');
      
      dispatch(setSourceLocation(defaultSource));
      dispatch(setDestinationLocation(defaultDestination));
      dispatch(setSourceAddress('Trevi Fountain, Rome, Italy'));
      dispatch(setDestinationAddress('Spanish Steps, Rome, Italy'));
      
      setSourceRecognized(true);
      setDestinationRecognized(true);
      setIsInitializing(false);
      return;
    }

    // Parse coordinates
    const parseCoordinates = (param: string): { lat: number; lng: number } | null => {
      const parts = param.split(',');
      if (parts.length !== 2) return null;
      
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      
      if (isNaN(lat) || isNaN(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      
      return { lat, lng };
    };

    const srcCoords = parseCoordinates(srcParam);
    const dstCoords = parseCoordinates(dstParam);

    console.log('[useLocationParams] 📐 Parsed coordinates:', { srcCoords, dstCoords });

    // Validate coordinates
    if (!srcCoords) {
      console.error('[useLocationParams] ❌ Invalid source coordinates:', srcParam);
      setSourceError({
        attemptedLocation: srcParam,
        errorMessage: 'Invalid coordinates format',
      });
      setIsInitializing(false);
      return;
    }

    if (!dstCoords) {
      console.error('[useLocationParams] ❌ Invalid destination coordinates:', dstParam);
      setDestinationError({
        attemptedLocation: dstParam,
        errorMessage: 'Invalid coordinates format',
      });
      setIsInitializing(false);
      return;
    }

    // Reverse geocode to get addresses (NO OpenAI calls here!)
    const geocoder = new google.maps.Geocoder();

    Promise.all([
      geocoder.geocode({ location: srcCoords }),
      geocoder.geocode({ location: dstCoords }),
    ])
      .then(([srcResult, dstResult]) => {
        console.log('[useLocationParams] 🗺️ Geocoding results:', {
          source: srcResult.results[0]?.formatted_address,
          destination: dstResult.results[0]?.formatted_address,
        });

        const srcAddr = srcResult.results[0]?.formatted_address || 'Unknown location';
        const dstAddr = dstResult.results[0]?.formatted_address || 'Unknown location';

        // Store in local state
        setSourceLocationState(srcCoords);
        setDestinationLocationState(dstCoords);
        setSourceAddressState(srcAddr);
        setDestinationAddressState(dstAddr);

        // Store in Redux (NO OpenAI calls triggered here!)
        dispatch(setSourceLocation(srcCoords));
        dispatch(setDestinationLocation(dstCoords));
        dispatch(setSourceAddress(srcAddr));
        dispatch(setDestinationAddress(dstAddr));

        setSourceRecognized(true);
        setDestinationRecognized(true);
        setIsInitializing(false);

        console.log('[useLocationParams] ✅ Location parameters parsed successfully (NO OpenAI calls made)');
      })
      .catch((error) => {
        console.error('[useLocationParams] ❌ Geocoding error:', error);
        setError('Failed to geocode locations');
        setIsInitializing(false);
      });
  }, [isGoogleMapsLoaded, dispatch]);

  return {
    error,
    sourceError,
    destinationError,
    sourceRecognized,
    destinationRecognized,
    isInitializing,
    sourceLocation,
    destinationLocation,
    sourceAddress,
    destinationAddress,
  };
};
