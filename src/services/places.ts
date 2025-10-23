export interface PlaceDetails {
  description: string;
  name: string;
  types: string[];
  enhancedDescription?: string;
}

export interface PlaceDetailsResult {
  details: PlaceDetails;
}

export interface PlaceDetailsError {
  error: string;
}

/**
 * Fetch place details using Google Places API (Place module)
 * This provides rich information about a specific location
 */
export const fetchPlaceDetails = async (
  location: { lat: number; lng: number }
): Promise<PlaceDetailsResult | PlaceDetailsError> => {
  console.log('[Places API] 🔍 Fetching place details for:', location);

  if (!window.google || !window.google.maps || !window.google.maps.places) {
    console.error('[Places API] ❌ Google Maps Places API not loaded');
    return { error: 'Google Maps Places API not loaded' };
  }

  try {
    console.log('[Places API] 🔧 Using Place.searchNearby to find closest place...');

    // Create a LatLng object for the location
    const center = new google.maps.LatLng(location.lat, location.lng);

    // Use Place.searchNearby to find places near the location
    const request = {
      fields: ['id', 'displayName', 'location', 'types'],
      locationRestriction: {
        center: center,
        radius: 50, // Search within 50 meters
      },
      maxResultCount: 5,
    };

    console.log('[Places API] 📡 Searching for nearby places...');

    // Call searchNearby
    const { places } = await google.maps.places.Place.searchNearby(request);

    if (!places || places.length === 0) {
      console.warn('[Places API] ⚠️ No nearby places found');
      return {
        details: {
          description: 'Location details not available',
          name: 'Unknown Location',
          types: [],
        },
      };
    }

    console.log('[Places API] ✅ Found nearby places:', places.length);

    // Get the closest place (first result is typically closest)
    const closestPlace = places[0];

    console.log('[Places API] 📡 Fetching detailed information for place:', closestPlace.id);

    // Fetch additional fields for the place
    await closestPlace.fetchFields({
      fields: [
        'displayName',
        'formattedAddress',
        'types',
        'editorialSummary',
        'location',
      ],
    });

    console.log('[Places API] ✅ Place details retrieved:', {
      name: closestPlace.displayName,
      hasEditorialSummary: !!closestPlace.editorialSummary,
      types: closestPlace.types,
    });

    // Build description from available information
    let description = '';

    if (closestPlace.editorialSummary) {
      description = closestPlace.editorialSummary;
    } else if (closestPlace.formattedAddress) {
      description = closestPlace.formattedAddress;
    } else {
      description = closestPlace.displayName || 'Location details not available';
    }

    const placeDetails: PlaceDetails = {
      description: description,
      name: closestPlace.displayName || 'Unknown Location',
      types: closestPlace.types || [],
    };

    console.log('[Places API] ✅ Place details processed:', placeDetails);

    return { details: placeDetails };
  } catch (error) {
    console.error('[Places API] ❌ Error fetching place details:', error);
    return {
      error: `Failed to fetch place details: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
