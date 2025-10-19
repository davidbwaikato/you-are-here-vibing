export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  location: LatLng;
  formattedAddress: string;
}

export interface GeocodeError {
  error: string;
}

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

    const geocodeResult = {
      location: {
        lat: location.lat(),
        lng: location.lng(),
      },
      formattedAddress,
    };

    console.log('[Geocoding] ✅ Geocode successful:', {
      input: locationString,
      output: formattedAddress,
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
