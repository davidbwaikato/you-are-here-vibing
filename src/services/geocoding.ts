/**
 * Geocoding Service
 * Handles conversion of location strings to LatLng coordinates using Google Maps Geocoder
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  location: LatLng;
  formattedAddress: string;
}

export interface GeocodingError {
  error: string;
  status: string;
}

/**
 * Geocode a location string to LatLng coordinates
 * @param locationString - Address or place name to geocode
 * @returns Promise with location data or error
 */
export const geocodeLocation = async (
  locationString: string
): Promise<GeocodingResult | GeocodingError> => {
  return new Promise((resolve) => {
    if (!window.google || !window.google.maps) {
      resolve({
        error: 'Google Maps API not loaded',
        status: 'ERROR',
      });
      return;
    }

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode(
      { address: locationString },
      (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            location: {
              lat: location.lat(),
              lng: location.lng(),
            },
            formattedAddress: results[0].formatted_address,
          });
        } else {
          resolve({
            error: `Geocoding failed: ${status}`,
            status: status,
          });
        }
      }
    );
  });
};

/**
 * Batch geocode multiple locations
 * @param locations - Array of location strings
 * @returns Promise with array of results
 */
export const geocodeMultipleLocations = async (
  locations: string[]
): Promise<(GeocodingResult | GeocodingError)[]> => {
  const promises = locations.map((location) => geocodeLocation(location));
  return Promise.all(promises);
};
