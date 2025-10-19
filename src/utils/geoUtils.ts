/**
 * Geographic utility functions for route processing
 */

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
 * Calculate segments with distances for a polyline
 */
export const calculatePolylineSegments = (
  points: LatLng[]
): PolylineSegment[] => {
  if (points.length < 2) {
    console.warn('[GeoUtils] ⚠️ Polyline has fewer than 2 points, cannot calculate segments');
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

  console.log('[GeoUtils] 📏 Calculated segments:', {
    totalSegments: segments.length,
    totalDistance: segments.reduce((sum, seg) => sum + seg.distanceMeters, 0).toFixed(2) + 'm',
  });

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
  console.log('[GeoUtils] 🔄 Starting polyline interpolation:', {
    inputPoints: points.length,
    maxSpacing: maxSpacing + 'm',
  });

  if (points.length < 2) {
    console.warn('[GeoUtils] ⚠️ Polyline has fewer than 2 points, returning as-is');
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

      console.log(`[GeoUtils] 📍 Segment ${i + 1}: ${segmentDistance.toFixed(2)}m - Adding ${numInterpolations} interpolation points (spacing: ${actualSpacing.toFixed(2)}m)`);

      // Add evenly distributed interpolation points
      for (let j = 1; j <= numInterpolations; j++) {
        const distanceFromStart = j * actualSpacing;
        const interpolated = interpolatePoint(start, end, distanceFromStart, segmentDistance);
        interpolatedPoints.push(interpolated);
        interpolatedCount++;
      }
    } else {
      console.log(`[GeoUtils] ✅ Segment ${i + 1}: ${segmentDistance.toFixed(2)}m - No interpolation needed`);
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

  console.log('[GeoUtils] ✅ Interpolation complete:', {
    originalPoints: result.originalPointCount,
    interpolatedPoints: result.interpolatedPointCount,
    totalPoints: result.points.length,
    totalDistance: result.totalDistance.toFixed(2) + 'm',
    averageSpacing: (result.totalDistance / (result.points.length - 1)).toFixed(2) + 'm',
  });

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
  console.log('[GeoUtils] 🔍 Filtering points by distance:', {
    inputPoints: points.length,
    referencePoint,
    minDistance: minDistance + 'm',
    maxDistance: maxDistance + 'm',
  });

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

  console.log('[GeoUtils] ✅ Distance filtering complete:', {
    outputPoints: filteredPoints.length,
    excludedTooClose: tooClose,
    excludedTooFar: tooFar,
    retentionRate: ((filteredPoints.length / points.length) * 100).toFixed(1) + '%',
  });

  return filteredPoints;
};
