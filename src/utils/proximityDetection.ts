import * as THREE from 'three';

/**
 * Check if a 3D point is inside a cuboid boundary
 * Cuboid dimensions: 10x10x3 meters (width x depth x height)
 * Positioned at ground level with y-axis compensation for Street View eye level
 */
export const isPointInsideCuboid = (
  point: THREE.Vector3,
  cuboidCenter: THREE.Vector3,
  width: number = 10,
  depth: number = 10,
  height: number = 3
): boolean => {
  // Calculate half dimensions for boundary checking
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const halfHeight = height / 2;

  // Check if point is within cuboid boundaries
  const isInsideX = Math.abs(point.x - cuboidCenter.x) <= halfWidth;
  const isInsideY = Math.abs(point.y - cuboidCenter.y) <= halfHeight;
  const isInsideZ = Math.abs(point.z - cuboidCenter.z) <= halfDepth;

  return isInsideX && isInsideY && isInsideZ;
};

/**
 * Convert lat/lng to 3D position relative to user position
 * Returns THREE.Vector3 in local coordinate system
 */
export const latLngTo3DPosition = (
  targetLat: number,
  targetLng: number,
  userLat: number,
  userLng: number
): THREE.Vector3 => {
  // Earth radius in meters
  const EARTH_RADIUS = 6371000;

  // Convert to radians
  const lat1 = (userLat * Math.PI) / 180;
  const lat2 = (targetLat * Math.PI) / 180;
  const lng1 = (userLng * Math.PI) / 180;
  const lng2 = (targetLng * Math.PI) / 180;

  // Calculate differences
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;

  // Calculate x and z distances in meters
  const x = dLng * EARTH_RADIUS * Math.cos((lat1 + lat2) / 2);
  const z = -dLat * EARTH_RADIUS; // Negative because north is -z in Three.js

  // Street View eye level is at y=0, ground is at y=-1.7
  // Cuboid center is at ground + half height = -1.7 + 1.5 = -0.2
  const y = -0.2;

  return new THREE.Vector3(x, y, z);
};

/**
 * Check if user is inside a location cuboid
 */
export const isUserInsideLocationCuboid = (
  userPosition: { lat: number; lng: number },
  locationPosition: { lat: number; lng: number }
): boolean => {
  // User is always at origin (0, 0, 0) in their local coordinate system
  const userPoint = new THREE.Vector3(0, 0, 0);

  // Convert location to 3D position relative to user
  const locationPoint = latLngTo3DPosition(
    locationPosition.lat,
    locationPosition.lng,
    userPosition.lat,
    userPosition.lng
  );

  // Check if user is inside the cuboid
  return isPointInsideCuboid(userPoint, locationPoint);
};
