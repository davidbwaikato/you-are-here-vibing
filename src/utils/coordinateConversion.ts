import * as THREE from 'three';
import { LatLng } from './geoUtils';

/**
 * Coordinate conversion utilities for transforming geographic coordinates
 * to Three.js 3D space
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Polyline3D {
  points: Point3D[];
  vectors: THREE.Vector3[];
  totalLength: number;
}

/**
 * Convert a LatLng coordinate to a local 3D coordinate relative to an origin point
 * 
 * This uses a simple planar approximation suitable for short distances (< 1km)
 * - X axis: East-West (positive = East)
 * - Y axis: Vertical (always 0 for ground-level routes)
 * - Z axis: North-South (negative = North, to match Three.js forward direction)
 * 
 * @param point - The point to convert
 * @param origin - The origin point (typically current Street View position)
 * @returns 3D coordinates in meters relative to origin
 */
export const latLngTo3D = (point: LatLng, origin: LatLng): Point3D => {
  // Earth's radius in meters
  const R = 6371000;

  // Convert to radians
  const lat1 = (origin.lat * Math.PI) / 180;
  const lat2 = (point.lat * Math.PI) / 180;
  const deltaLat = ((point.lat - origin.lat) * Math.PI) / 180;
  const deltaLng = ((point.lng - origin.lng) * Math.PI) / 180;

  // Calculate distances in meters using planar approximation
  // For small distances, this is accurate enough and much faster than spherical calculations
  const x = deltaLng * R * Math.cos((lat1 + lat2) / 2); // East-West
  const z = -deltaLat * R; // North-South (negative because Three.js Z+ is towards viewer)
  const y = 0; // Ground level (Street View origin is at eye level, so ground is below)

  return { x, y, z };
};

/**
 * Convert a 2D LatLng polyline to a 3D polyline in Three.js space
 * 
 * @param points - Array of LatLng points forming the polyline
 * @param origin - The origin point for coordinate conversion (current Street View position)
 * @returns 3D polyline data structure with points and Three.js vectors
 */
export const polylineTo3D = (
  points: LatLng[],
  origin: LatLng
): Polyline3D => {
  console.log('[CoordConversion] 🔄 Converting 2D polyline to 3D:', {
    inputPoints: points.length,
    origin,
  });

  if (points.length === 0) {
    console.warn('[CoordConversion] ⚠️ Empty polyline provided');
    return {
      points: [],
      vectors: [],
      totalLength: 0,
    };
  }

  // Convert each LatLng point to 3D coordinates
  const points3D: Point3D[] = points.map((point, index) => {
    const point3D = latLngTo3D(point, origin);
    
    if (index === 0) {
      console.log('[CoordConversion] 📍 First point (origin):', {
        latLng: point,
        point3D,
      });
    } else if (index === points.length - 1) {
      console.log('[CoordConversion] 📍 Last point:', {
        latLng: point,
        point3D,
        distanceFromOrigin: Math.sqrt(point3D.x ** 2 + point3D.z ** 2).toFixed(2) + 'm',
      });
    }

    return point3D;
  });

  // Create Three.js Vector3 objects for rendering
  const vectors: THREE.Vector3[] = points3D.map(
    (p) => new THREE.Vector3(p.x, p.y, p.z)
  );

  // Calculate total length of the 3D polyline
  let totalLength = 0;
  for (let i = 0; i < vectors.length - 1; i++) {
    totalLength += vectors[i].distanceTo(vectors[i + 1]);
  }

  console.log('[CoordConversion] ✅ 3D polyline conversion complete:', {
    outputPoints: points3D.length,
    totalLength: totalLength.toFixed(2) + 'm',
    boundingBox: {
      minX: Math.min(...points3D.map((p) => p.x)).toFixed(2),
      maxX: Math.max(...points3D.map((p) => p.x)).toFixed(2),
      minZ: Math.min(...points3D.map((p) => p.z)).toFixed(2),
      maxZ: Math.max(...points3D.map((p) => p.z)).toFixed(2),
    },
  });

  return {
    points: points3D,
    vectors,
    totalLength,
  };
};

/**
 * Update 3D polyline when origin changes (e.g., user moves to new Street View position)
 * This recalculates all 3D coordinates relative to the new origin
 */
export const updatePolyline3DOrigin = (
  originalLatLngPoints: LatLng[],
  newOrigin: LatLng
): Polyline3D => {
  console.log('[CoordConversion] 🔄 Updating 3D polyline with new origin:', newOrigin);
  return polylineTo3D(originalLatLngPoints, newOrigin);
};
