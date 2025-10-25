import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { 
  setSourceLocation, 
  setDestinationLocation, 
  setSourceAddress, 
  setDestinationAddress,
  setCurrentShortName,
  setDestinationShortName,
  setPosition 
} from '@/store/streetViewSlice';
import { reverseGeocodeLocation } from '@/services/geocoding';
import type { LocationError } from '@/components/LocationSearchPage';

interface LocationData {
  lat: number;
  lng: number;
  address: string;
  shortName: string;
}

export const useLocationParams = (isGoogleMapsLoaded: boolean) => {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<LocationError | null>(null);
  const [destinationError, setDestinationError] = useState<LocationError | null>(null);
  const [sourceRecognized, setSourceRecognized] = useState(false);
  const [destinationRecognized, setDestinationRecognized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sourceLocation, setSourceLocationState] = useState<LocationData | null>(null);
  const [destinationLocation, setDestinationLocationState] = useState<LocationData | null>(null);
  const [sourceAddress, setSourceAddressState] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddressState] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleMapsLoaded) {
      console.log('[useLocationParams] ⏳ Waiting for Google Maps to load...');
      return;
    }

    console.log('[useLocationParams] 🚀 Google Maps loaded, processing URL parameters...');

    const urlParams = new URLSearchParams(window.location.search);
    const srcParam = urlParams.get('src');
    const dstParam = urlParams.get('dst');

    console.log('[useLocationParams] 📍 URL Parameters:', { srcParam, dstParam });

    if (!srcParam || !dstParam) {
      console.log('[useLocationParams] ⚠️ Missing required parameters');
      setError('Missing source or destination parameters');
      setIsInitializing(false);
      return;
    }

    const parseCoordinates = (param: string): { lat: number; lng: number } | null => {
      const parts = param.split(',');
      if (parts.length !== 2) return null;
      
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      
      if (isNaN(lat) || isNaN(lng)) return null;
      
      return { lat, lng };
    };

    const srcCoords = parseCoordinates(srcParam);
    const dstCoords = parseCoordinates(dstParam);

    console.log('[useLocationParams] 🗺️ Parsed Coordinates:', { srcCoords, dstCoords });

    if (!srcCoords || !dstCoords) {
      console.log('[useLocationParams] ❌ Invalid coordinate format');
      setError('Invalid coordinate format');
      setIsInitializing(false);
      return;
    }

    const geocodeLocation = async (
      coords: { lat: number; lng: number },
      locationType: 'source' | 'destination'
    ): Promise<{ address: string; shortName: string } | null> => {
      console.log(`[useLocationParams] 🔍 Geocoding ${locationType}:`, coords);
      
      try {
        const result = await reverseGeocodeLocation(coords);
        
        console.log(`[useLocationParams] 📍 Geocode result for ${locationType}:`, result);

        if ('error' in result) {
          console.log(`[useLocationParams] ⚠️ Geocoding failed for ${locationType}:`, result.error);
          
          if (locationType === 'source') {
            setSourceError({
              attemptedLocation: `${coords.lat}, ${coords.lng}`,
              errorMessage: result.error
            });
          } else {
            setDestinationError({
              attemptedLocation: `${coords.lat}, ${coords.lng}`,
              errorMessage: result.error
            });
          }
          
          return null;
        }

        console.log(`[useLocationParams] ✅ ${locationType} geocoded:`, {
          shortName: result.shortName,
          fullAddress: result.formattedAddress,
        });

        if (locationType === 'source') {
          setSourceRecognized(true);
          setSourceError(null);
        } else {
          setDestinationRecognized(true);
          setDestinationError(null);
        }

        return { address: result.formattedAddress, shortName: result.shortName };
      } catch (err) {
        console.error(`[useLocationParams] ❌ Geocoding error for ${locationType}:`, err);
        
        if (locationType === 'source') {
          setSourceError({
            attemptedLocation: `${coords.lat}, ${coords.lng}`,
            errorMessage: 'Failed to geocode location'
          });
        } else {
          setDestinationError({
            attemptedLocation: `${coords.lat}, ${coords.lng}`,
            errorMessage: 'Failed to geocode location'
          });
        }
        
        return null;
      }
    };

    const initializeLocations = async () => {
      console.log('[useLocationParams] 🔄 Starting location initialization...');
      
      const [srcGeocode, dstGeocode] = await Promise.all([
        geocodeLocation(srcCoords, 'source'),
        geocodeLocation(dstCoords, 'destination')
      ]);

      console.log('[useLocationParams] 📊 Geocoding complete:', {
        source: srcGeocode,
        destination: dstGeocode,
      });

      if (srcGeocode) {
        console.log('[useLocationParams] 💾 Storing source location in Redux:', {
          coords: srcCoords,
          address: srcGeocode.address,
          shortName: srcGeocode.shortName,
        });
        
        dispatch(setSourceLocation(srcCoords));
        dispatch(setSourceAddress(srcGeocode.address));
        dispatch(setCurrentShortName(srcGeocode.shortName));
        dispatch(setPosition(srcCoords));
        
        setSourceLocationState({
          ...srcCoords,
          address: srcGeocode.address,
          shortName: srcGeocode.shortName,
        });
        setSourceAddressState(srcGeocode.address);
      }

      if (dstGeocode) {
        console.log('[useLocationParams] 💾 Storing destination location in Redux:', {
          coords: dstCoords,
          address: dstGeocode.address,
          shortName: dstGeocode.shortName,
        });
        
        dispatch(setDestinationLocation(dstCoords));
        dispatch(setDestinationAddress(dstGeocode.address));
        dispatch(setDestinationShortName(dstGeocode.shortName));
        
        setDestinationLocationState({
          ...dstCoords,
          address: dstGeocode.address,
          shortName: dstGeocode.shortName,
        });
        setDestinationAddressState(dstGeocode.address);
      }

      console.log('[useLocationParams] ✅ Location initialization complete');
      setIsInitializing(false);
    };

    initializeLocations();
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
