export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteStep {
  startLocation: LatLng;
  endLocation: LatLng;
  polyline: {
    encodedPolyline: string;
  };
  distanceMeters: number;
  staticDuration: string;
  navigationInstruction?: {
    instructions: string;
    maneuver?: string;
  };
}

export interface RouteResult {
  polyline: {
    encodedPolyline: string;
  };
  distanceMeters: number;
  duration: string;
  steps: RouteStep[];
  decodedPolyline: LatLng[];
}

export interface RouteError {
  error: string;
}

/**
 * Decode a Google Maps encoded polyline string into an array of LatLng coordinates
 */
const decodePolyline = (encoded: string): LatLng[] => {
  const poly: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return poly;
};

/**
 * Fetch walking route from Google Maps Routes API
 * Uses computeRoutes endpoint with walking travel mode
 */
export const fetchWalkingRoute = async (
  origin: LatLng,
  destination: LatLng,
  apiKey: string
): Promise<RouteResult | RouteError> => {
  console.log('[Routing] 🚶 Starting route calculation');
  console.log('[Routing] 📍 Origin:', origin);
  console.log('[Routing] 📍 Destination:', destination);

  try {
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      },
      travelMode: 'WALK',
      routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
      },
      languageCode: 'en-US',
      units: 'METRIC',
    };

    console.log('[Routing] 📡 Sending request to Routes API...');
    
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 
            'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,' +
            'routes.legs.steps.startLocation,routes.legs.steps.endLocation,' +
            'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,' +
            'routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Routing] ❌ API request failed:', response.status, errorText);
      return { 
        error: `Routes API request failed: ${response.status} ${response.statusText}` 
      };
    }

    const data = await response.json();
    console.log('[Routing] 📥 Received response from Routes API');

    if (!data.routes || data.routes.length === 0) {
      console.error('[Routing] ❌ No routes found in response');
      return { error: 'No routes found between the specified locations' };
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];

    if (!leg || !leg.steps) {
      console.error('[Routing] ❌ Invalid route structure');
      return { error: 'Invalid route data received from API' };
    }

    // Decode the main route polyline
    const decodedPolyline = decodePolyline(route.polyline.encodedPolyline);

    // Extract step information
    const steps: RouteStep[] = leg.steps.map((step: any) => ({
      startLocation: {
        lat: step.startLocation.latLng.latitude,
        lng: step.startLocation.latLng.longitude,
      },
      endLocation: {
        lat: step.endLocation.latLng.latitude,
        lng: step.endLocation.latLng.longitude,
      },
      polyline: {
        encodedPolyline: step.polyline.encodedPolyline,
      },
      distanceMeters: step.distanceMeters,
      staticDuration: step.staticDuration,
      navigationInstruction: step.navigationInstruction,
    }));

    const routeResult: RouteResult = {
      polyline: {
        encodedPolyline: route.polyline.encodedPolyline,
      },
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      steps,
      decodedPolyline,
    };

    console.log('[Routing] ✅ Route calculation successful');
    console.log('[Routing] 📊 Route summary:');
    console.log(`  - Distance: ${(routeResult.distanceMeters / 1000).toFixed(2)} km`);
    console.log(`  - Duration: ${routeResult.duration}`);
    console.log(`  - Steps: ${routeResult.steps.length}`);
    console.log(`  - Polyline points: ${routeResult.decodedPolyline.length}`);
    console.log('[Routing] 🗺️ Full route data:', routeResult);

    return routeResult;
  } catch (error) {
    console.error('[Routing] ❌ Route calculation failed:', error);
    return { 
      error: `Failed to calculate route: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};
