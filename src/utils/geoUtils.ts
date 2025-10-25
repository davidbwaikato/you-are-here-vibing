/**
 * Geographic utility functions for route processing
 */

// Debug flag to control console logging
const DEBUG_GEO_UTILS = false;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PolylineSegment {
  start: LatLng;
  end: LatLng;
  distanceMeters: number;
}

export interface InterpolatedPolyline {
  points: LatLng[];
  originalPointCount: number;
  interpolatedPointCount: number;
  totalDistance: number;
}

export interface MarkerVisibility {
  distance: number;
  isVisible: boolean;
  bearing: number;
}

export interface VisibleMarkerInfo {
  originalRouteIndex: number;
  distance: number;
  bearing: number;
}

export interface VisibleMarkersResult {
  visibleMarkers: VisibleMarkerInfo[];
  closestMarkerIndex: number;
  totalMarkersChecked: number;
  visibleCount: number;
}

/**
 * Calculate distance between two LatLng points using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (point1: LatLng, point2: LatLng): number => {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Calculate bearing (angle from North) from one LatLng point to another
 * Returns bearing in degrees (0-360, where 0 = North, 90 = East, 180 = South, 270 = West)
 */
export const calculateBearing = (from: LatLng, to: LatLng): number => {
  const lat1Rad = (from.lat * Math.PI) / 180;
  const lat2Rad = (to.lat * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLng);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180) / Math.PI;

  // Normalize to 0-360 range
  return (bearingDeg + 360) % 360;
};

/**
 * Calculate the angular difference between two bearings
 * Handles wrapping around 0°/360° correctly
 * Returns the smallest angle between the two bearings (0-180°)
 */
export const calculateAngularDifference = (
  bearing1: number,
  bearing2: number
): number => {
  let diff = Math.abs(bearing1 - bearing2);
  
  // Handle wrapping around 0°/360°
  if (diff > 180) {
    diff = 360 - diff;
  }
  
  return diff;
};

/**
 * Calculate marker visibility based on user's position and field of view
 * 
 * Determines if a route marker is visible to the user based on:
 * - Distance from user to marker (returned for reference)
 * - Whether marker falls within user's horizontal field of view
 * 
 * Note: This method does NOT apply distance filtering (5m-100m range).
 * Distance filtering should be applied before calling this method.
 * 
 * @param userPosition - User's current LatLng position
 * @param markerPosition - Route marker's LatLng position
 * @param userHeading - User's current heading in degrees (0-360, where 0 = North)
 * @param userFOV - User's horizontal field of view in degrees (e.g., 75° for typical camera)
 * @returns Object containing distance (meters), visibility status, and bearing to marker
 */
export const calculateMarkerVisibility = (
  userPosition: LatLng,
  markerPosition: LatLng,
  userHeading: number,
  userFOV: number
): MarkerVisibility => {
  // Calculate distance from user to marker
  const distance = calculateDistance(userPosition, markerPosition);

  // Calculate bearing from user to marker
  const bearing = calculateBearing(userPosition, markerPosition);

  // Calculate angular difference between user's heading and marker bearing
  const angularDiff = calculateAngularDifference(userHeading, bearing);

  // Marker is visible if it falls within the FOV cone
  // FOV cone extends ±(FOV/2) from the user's heading
  const halfFOV = userFOV / 2;
  const isVisible = angularDiff <= halfFOV;

  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] 👁️ Marker visibility check:', {
      distance: distance.toFixed(2) + 'm',
      bearing: bearing.toFixed(1) + '°',
      userHeading: userHeading.toFixed(1) + '°',
      angularDiff: angularDiff.toFixed(1) + '°',
      userFOV: userFOV.toFixed(1) + '°',
      halfFOV: halfFOV.toFixed(1) + '°',
      isVisible,
    });
  }

  return {
    distance,
    isVisible,
    bearing,
  };
};

/**
 * Get all visible markers from a route based on user's position, heading, and FOV
 * 
 * This method combines distance filtering (5m-100m) with FOV-based visibility detection
 * to return only the markers that are currently visible to the user.
 * 
 * The returned array preserves the order of markers as they appear in the original route,
 * and includes the index position (within the visible markers array) of the closest marker.
 * 
 * @param route - Array of LatLng points representing the complete route
 * @param userPosition - User's current LatLng position
 * @param userHeading - User's current heading in degrees (0-360, where 0 = North)
 * @param userFOV - User's horizontal field of view in degrees (e.g., 75° for typical camera)
 * @param minDistance - Minimum distance in meters (default: 5m)
 * @param maxDistance - Maximum distance in meters (default: 100m)
 * @returns Object containing visible markers array, closest marker index, and statistics
 */
export const getVisibleMarkers = (
  route: LatLng[],
  userPosition: LatLng,
  userHeading: number,
  userFOV: number,
  minDistance: number = 5,
  maxDistance: number = 100
): VisibleMarkersResult => {
  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] 🔍 Starting visible markers detection:', {
      totalRoutePoints: route.length,
      userPosition,
      userHeading: userHeading.toFixed(1) + '°',
      userFOV: userFOV.toFixed(1) + '°',
      distanceRange: `${minDistance}m - ${maxDistance}m`,
    });
  }

  const visibleMarkers: VisibleMarkerInfo[] = [];
  let closestDistance = Infinity;
  let closestMarkerIndex = -1;

  // Iterate through all route points with index tracking
  for (let i = 0; i < route.length; i++) {
    const marker = route[i];

    // Calculate distance from user to marker
    const distance = calculateDistance(userPosition, marker);

    // Apply distance filtering (5m-100m range)
    if (distance < minDistance || distance > maxDistance) {
      continue; // Skip markers outside distance range
    }

    // Check FOV visibility
    const visibility = calculateMarkerVisibility(
      userPosition,
      marker,
      userHeading,
      userFOV
    );

    // If marker is visible, add to results
    if (visibility.isVisible) {
      const markerInfo: VisibleMarkerInfo = {
        originalRouteIndex: i,
        distance: visibility.distance,
        bearing: visibility.bearing,
      };

      visibleMarkers.push(markerInfo);

      // Track closest marker within visible set
      if (visibility.distance < closestDistance) {
        closestDistance = visibility.distance;
        closestMarkerIndex = visibleMarkers.length - 1; // Index within visible markers array
      }

      if (DEBUG_GEO_UTILS) {
        console.log(`[GeoUtils] ✅ Visible marker found:`, {
          originalRouteIndex: i,
          distance: visibility.distance.toFixed(2) + 'm',
          bearing: visibility.bearing.toFixed(1) + '°',
          visibleArrayIndex: visibleMarkers.length - 1,
        });
      }
    }
  }

  const result: VisibleMarkersResult = {
    visibleMarkers,
    closestMarkerIndex,
    totalMarkersChecked: route.length,
    visibleCount: visibleMarkers.length,
  };

  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] ✅ Visible markers detection complete:', {
      totalMarkersChecked: result.totalMarkersChecked,
      visibleCount: result.visibleCount,
      closestMarkerIndex: result.closestMarkerIndex,
      closestDistance: closestDistance !== Infinity ? closestDistance.toFixed(2) + 'm' : 'N/A',
      retentionRate: ((result.visibleCount / result.totalMarkersChecked) * 100).toFixed(1) + '%',
    });
  }

  return result;
};

/**
 * Calculate segments with distances for a polyline
 */
export const calculatePolylineSegments = (
  points: LatLng[]
): PolylineSegment[] => {
  if (points.length < 2) {
    if (DEBUG_GEO_UTILS) {
      console.warn('[GeoUtils] ⚠️ Polyline has fewer than 2 points, cannot calculate segments');
    }
    return [];
  }

  const segments: PolylineSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const distanceMeters = calculateDistance(start, end);

    segments.push({
      start,
      end,
      distanceMeters,
    });
  }

  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] 📏 Calculated segments:', {
      totalSegments: segments.length,
      totalDistance: segments.reduce((sum, seg) => sum + seg.distanceMeters, 0).toFixed(2) + 'm',
    });
  }

  return segments;
};

/**
 * Interpolate a point along a line segment at a specific distance from the start
 */
export const interpolatePoint = (
  start: LatLng,
  end: LatLng,
  distanceFromStart: number,
  totalSegmentDistance: number
): LatLng => {
  const fraction = distanceFromStart / totalSegmentDistance;

  // Linear interpolation in lat/lng space
  // Note: This is an approximation that works well for short distances
  const lat = start.lat + (end.lat - start.lat) * fraction;
  const lng = start.lng + (end.lng - start.lng) * fraction;

  return { lat, lng };
};

/**
 * Interpolate additional points along a polyline to ensure consistent spacing
 * 
 * For any two consecutive points where distance > maxSpacing, adds evenly
 * distributed interpolation points to maintain spacing ≤ maxSpacing
 * 
 * @param points - Original polyline points
 * @param maxSpacing - Maximum allowed spacing between consecutive points (meters)
 * @returns Interpolated polyline with consistent spacing
 */
export const interpolatePolyline = (
  points: LatLng[],
  maxSpacing: number
): InterpolatedPolyline => {
  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] 🔄 Starting polyline interpolation:', {
      inputPoints: points.length,
      maxSpacing: maxSpacing + 'm',
    });
  }

  if (points.length < 2) {
    if (DEBUG_GEO_UTILS) {
      console.warn('[GeoUtils] ⚠️ Polyline has fewer than 2 points, returning as-is');
    }
    return {
      points,
      originalPointCount: points.length,
      interpolatedPointCount: 0,
      totalDistance: 0,
    };
  }

  const interpolatedPoints: LatLng[] = [];
  let totalDistance = 0;
  let interpolatedCount = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const segmentDistance = calculateDistance(start, end);
    
    // Always add the start point
    interpolatedPoints.push(start);
    totalDistance += segmentDistance;

    // Check if interpolation is needed
    if (segmentDistance > maxSpacing) {
      // Calculate how many interpolation points we need
      // We want points roughly every maxSpacing meters
      const numInterpolations = Math.floor(segmentDistance / maxSpacing);
      const actualSpacing = segmentDistance / (numInterpolations + 1);

      if (DEBUG_GEO_UTILS) {
        console.log(`[GeoUtils] 📍 Segment ${i + 1}: ${segmentDistance.toFixed(2)}m - Adding ${numInterpolations} interpolation points (spacing: ${actualSpacing.toFixed(2)}m)`);
      }

      // Add evenly distributed interpolation points
      for (let j = 1; j <= numInterpolations; j++) {
        const distanceFromStart = j * actualSpacing;
        const interpolated = interpolatePoint(start, end, distanceFromStart, segmentDistance);
        interpolatedPoints.push(interpolated);
        interpolatedCount++;
      }
    } else {
      if (DEBUG_GEO_UTILS) {
        console.log(`[GeoUtils] ✅ Segment ${i + 1}: ${segmentDistance.toFixed(2)}m - No interpolation needed`);
      }
    }
  }

  // Add the final point
  interpolatedPoints.push(points[points.length - 1]);

  const result: InterpolatedPolyline = {
    points: interpolatedPoints,
    originalPointCount: points.length,
    interpolatedPointCount: interpolatedCount,
    totalDistance,
  };

  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] ✅ Interpolation complete:', {
      originalPoints: result.originalPointCount,
      interpolatedPoints: result.interpolatedPointCount,
      totalPoints: result.points.length,
      totalDistance: result.totalDistance.toFixed(2) + 'm',
      averageSpacing: (result.totalDistance / (result.points.length - 1)).toFixed(2) + 'm',
    });
  }

  return result;
};

/**
 * Filter polyline points based on distance from a reference point
 * 
 * Returns only points within the specified distance range (minDistance to maxDistance)
 * 
 * @param points - Polyline points to filter
 * @param referencePoint - Reference point (typically user's current position)
 * @param minDistance - Minimum distance in meters (points closer are excluded)
 * @param maxDistance - Maximum distance in meters (points farther are excluded)
 * @returns Filtered points within the distance range
 */
export const filterPointsByDistance = (
  points: LatLng[],
  referencePoint: LatLng,
  minDistance: number,
  maxDistance: number
): LatLng[] => {
  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] 🔍 Filtering points by distance:', {
      inputPoints: points.length,
      referencePoint,
      minDistance: minDistance + 'm',
      maxDistance: maxDistance + 'm',
    });
  }

  const filteredPoints: LatLng[] = [];
  let tooClose = 0;
  let tooFar = 0;

  for (const point of points) {
    const distance = calculateDistance(referencePoint, point);

    if (distance < minDistance) {
      tooClose++;
    } else if (distance > maxDistance) {
      tooFar++;
    } else {
      filteredPoints.push(point);
    }
  }

  if (DEBUG_GEO_UTILS) {
    console.log('[GeoUtils] ✅ Distance filtering complete:', {
      outputPoints: filteredPoints.length,
      excludedTooClose: tooClose,
      excludedTooFar: tooFar,
      retentionRate: ((filteredPoints.length / points.length) * 100).toFixed(1) + '%',
    });
  }

  return filteredPoints;
};
