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

export interface TruncatedPolyline {
  points: LatLng[];
  totalDistance: number;
  segmentCount: number;
  truncated: boolean;
  truncationPoint?: LatLng;
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
 * Truncate polyline to a maximum distance from the start point
 * Returns a new polyline with points up to the cutoff distance
 */
export const truncatePolyline = (
  points: LatLng[],
  maxDistanceMeters: number
): TruncatedPolyline => {
  console.log('[GeoUtils] ✂️ Starting polyline truncation:', {
    inputPoints: points.length,
    maxDistance: maxDistanceMeters + 'm',
  });

  if (points.length < 2) {
    console.warn('[GeoUtils] ⚠️ Polyline has fewer than 2 points, returning as-is');
    return {
      points,
      totalDistance: 0,
      segmentCount: 0,
      truncated: false,
    };
  }

  const segments = calculatePolylineSegments(points);
  const truncatedPoints: LatLng[] = [points[0]]; // Always include start point
  let accumulatedDistance = 0;
  let truncated = false;
  let truncationPoint: LatLng | undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentEndDistance = accumulatedDistance + segment.distanceMeters;

    if (segmentEndDistance <= maxDistanceMeters) {
      // Entire segment fits within the limit
      truncatedPoints.push(segment.end);
      accumulatedDistance = segmentEndDistance;
      
      console.log(`[GeoUtils] ✅ Segment ${i + 1}/${segments.length}: ${segment.distanceMeters.toFixed(2)}m (total: ${accumulatedDistance.toFixed(2)}m)`);
    } else {
      // This segment exceeds the limit - interpolate the cutoff point
      const remainingDistance = maxDistanceMeters - accumulatedDistance;
      truncationPoint = interpolatePoint(
        segment.start,
        segment.end,
        remainingDistance,
        segment.distanceMeters
      );
      
      truncatedPoints.push(truncationPoint);
      accumulatedDistance = maxDistanceMeters;
      truncated = true;

      console.log(`[GeoUtils] ✂️ Segment ${i + 1}/${segments.length}: Truncated at ${remainingDistance.toFixed(2)}m into segment`);
      console.log('[GeoUtils] 📍 Interpolated truncation point:', truncationPoint);
      break;
    }
  }

  const result: TruncatedPolyline = {
    points: truncatedPoints,
    totalDistance: accumulatedDistance,
    segmentCount: truncatedPoints.length - 1,
    truncated,
    truncationPoint,
  };

  console.log('[GeoUtils] ✅ Truncation complete:', {
    outputPoints: result.points.length,
    totalDistance: result.totalDistance.toFixed(2) + 'm',
    truncated: result.truncated,
    reductionPercent: ((1 - result.points.length / points.length) * 100).toFixed(1) + '%',
  });

  return result;
};
