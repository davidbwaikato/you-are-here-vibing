import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setCurrentShortName } from '@/store/streetViewSlice';
import { reverseGeocodeLocation } from '@/services/geocoding';

/**
 * Hook that watches for position changes and updates currentShortName via geocoding
 */
export const usePositionGeocoding = () => {
  const dispatch = useDispatch();
  const position = useSelector((state: RootState) => state.streetView.position);
  const currentShortName = useSelector((state: RootState) => state.streetView.currentShortName);
  
  // Track the last geocoded position to avoid redundant API calls
  const lastGeocodedPosition = useRef<{ lat: number; lng: number } | null>(null);
  
  // Track if geocoding is in progress
  const isGeocodingRef = useRef(false);

  useEffect(() => {
    console.log('[usePositionGeocoding] 📍 Position changed:', position);
    console.log('[usePositionGeocoding] 📝 Current short name:', currentShortName);

    // Skip if already geocoding
    if (isGeocodingRef.current) {
      console.log('[usePositionGeocoding] ⏳ Geocoding already in progress, skipping...');
      return;
    }

    // Skip if position hasn't changed significantly (within ~10 meters)
    if (lastGeocodedPosition.current) {
      const latDiff = Math.abs(position.lat - lastGeocodedPosition.current.lat);
      const lngDiff = Math.abs(position.lng - lastGeocodedPosition.current.lng);
      const threshold = 0.0001; // Approximately 10 meters

      if (latDiff < threshold && lngDiff < threshold) {
        console.log('[usePositionGeocoding] 📏 Position change too small, skipping geocoding');
        return;
      }
    }

    const geocodePosition = async () => {
      console.log('[usePositionGeocoding] 🚀 Starting geocoding for new position...');
      isGeocodingRef.current = true;

      try {
        const result = await reverseGeocodeLocation(position);

        if ('error' in result) {
          console.error('[usePositionGeocoding] ❌ Geocoding failed:', result.error);
          return;
        }

        console.log('[usePositionGeocoding] ✅ Geocoding successful:', {
          shortName: result.shortName,
          formattedAddress: result.formattedAddress,
        });

        // Only update if the short name is different
        if (result.shortName !== currentShortName) {
          console.log('[usePositionGeocoding] 🔄 Short name changed, updating Redux:', {
            old: currentShortName,
            new: result.shortName,
          });
          dispatch(setCurrentShortName(result.shortName));
        } else {
          console.log('[usePositionGeocoding] ✓ Short name unchanged, skipping update');
        }

        // Update last geocoded position
        lastGeocodedPosition.current = { ...position };
      } catch (error) {
        console.error('[usePositionGeocoding] ❌ Unexpected error during geocoding:', error);
      } finally {
        isGeocodingRef.current = false;
      }
    };

    geocodePosition();
  }, [position, currentShortName, dispatch]);
};
