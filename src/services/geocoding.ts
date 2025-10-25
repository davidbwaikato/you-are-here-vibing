export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  location: LatLng;
  formattedAddress: string;
  shortName: string;
}

export interface GeocodeError {
  error: string;
}

/**
 * Extract short name from geocoding result using priority order
 */
const extractShortName = (result: google.maps.GeocoderResult): string => {
  console.log('[Geocoding] 🔍 Extracting short name from result:', result);

  // Priority: point_of_interest > premise > establishment > route > locality > formatted_address
  const poiComponent = result.address_components.find(
    c => c.types.includes('point_of_interest') || 
         c.types.includes('premise') ||
         c.types.includes('establishment')
  );
  
  if (poiComponent) {
    console.log('[Geocoding] ✅ Found POI/premise/establishment:', poiComponent.long_name);
    return poiComponent.long_name;
  }

  // Fallback to street address or locality
  const streetComponent = result.address_components.find(
    c => c.types.includes('route') || c.types.includes('street_address')
  );
  
  if (streetComponent) {
    console.log('[Geocoding] ✅ Found route/street:', streetComponent.long_name);
    return streetComponent.long_name;
  }

  const localityComponent = result.address_components.find(
    c => c.types.includes('locality')
  );
  
  if (localityComponent) {
    console.log('[Geocoding] ✅ Found locality:', localityComponent.long_name);
    return localityComponent.long_name;
  }

  // Final fallback to formatted address
  console.log('[Geocoding] ⚠️ Using formatted address as fallback');
  return result.formatted_address;
};

/**
 * Geocode a location string to coordinates using Google Maps Geocoding API
 */
export const geocodeLocation = async (
  locationString: string
): Promise<GeocodeResult | GeocodeError> => {
  console.log('[Geocoding] 🔍 Starting geocode for:', locationString);
  
  if (!window.google || !window.google.maps) {
    console.error('[Geocoding] ❌ Google Maps not loaded');
    return { error: 'Google Maps not loaded' };
  }

  try {
    console.log('[Geocoding] 🔧 Initializing Geocoder class...');
    const geocoder = new google.maps.Geocoder();
    console.log('[Geocoding] ✅ Geocoder initialized');

    console.log('[Geocoding] 📡 Sending geocode request...');
    const result = await geocoder.geocode({ address: locationString });
    console.log('[Geocoding] 📥 Received geocode response');

    if (!result.results || result.results.length === 0) {
      console.error('[Geocoding] ❌ No results found for:', locationString);
      return { error: `Location not found: ${locationString}` };
    }

    const location = result.results[0].geometry.location;
    const formattedAddress = result.results[0].formatted_address;
    const shortName = extractShortName(result.results[0]);

    const geocodeResult = {
      location: {
        lat: location.lat(),
        lng: location.lng(),
      },
      formattedAddress,
      shortName,
    };

    console.log('[Geocoding] ✅ Geocode successful:', {
      input: locationString,
      output: formattedAddress,
      shortName,
      coordinates: geocodeResult.location,
    });

    return geocodeResult;
  } catch (error) {
    console.error('[Geocoding] ❌ Geocoding failed:', error);
    return { 
      error: `Failed to geocode location: ${locationString}` 
    };
  }
};

/**
 * Reverse geocode coordinates to get location details including short name
 */
export const reverseGeocodeLocation = async (
  coords: LatLng
): Promise<GeocodeResult | GeocodeError> => {
  console.log('[Geocoding] 🔍 Starting reverse geocode for:', coords);
  
  if (!window.google || !window.google.maps) {
    console.error('[Geocoding] ❌ Google Maps not loaded');
    return { error: 'Google Maps not loaded' };
  }

  try {
    console.log('[Geocoding] 🔧 Initializing Geocoder class...');
    const geocoder = new google.maps.Geocoder();
    console.log('[Geocoding] ✅ Geocoder initialized');

    console.log('[Geocoding] 📡 Sending reverse geocode request...');
    const result = await geocoder.geocode({ location: coords });
    console.log('[Geocoding] 📥 Received reverse geocode response');

    if (!result.results || result.results.length === 0) {
      console.error('[Geocoding] ❌ No results found for:', coords);
      return { error: `Location not found: ${coords.lat}, ${coords.lng}` };
    }

    const location = result.results[0].geometry.location;
    const formattedAddress = result.results[0].formatted_address;
    const shortName = extractShortName(result.results[0]);

    const geocodeResult = {
      location: {
        lat: location.lat(),
        lng: location.lng(),
      },
      formattedAddress,
      shortName,
    };

    console.log('[Geocoding] ✅ Reverse geocode successful:', {
      input: coords,
      output: formattedAddress,
      shortName,
      coordinates: geocodeResult.location,
    });

    return geocodeResult;
  } catch (error) {
    console.error('[Geocoding] ❌ Reverse geocoding failed:', error);
    return { 
      error: `Failed to reverse geocode location: ${coords.lat}, ${coords.lng}` 
    };
  }
};
