// Shoulder rotation tracking utilities

import { BlazePoseKeypoint } from '@/types/detection';

/**
 * Calculate shoulder swivel angle from keypoints (Y-Z plane rotation)
 * Returns angle in degrees, or null if shoulders not detected
 */
export const calculateShoulderAngle = (keypoints: BlazePoseKeypoint[]): number | null => {
  // CRITICAL: BlazePose uses camelCase - "leftShoulder" and "rightShoulder"
  const leftShoulder = keypoints.find(kp => kp.part === 'leftShoulder');
  const rightShoulder = keypoints.find(kp => kp.part === 'rightShoulder');
  
  if (!leftShoulder || !rightShoulder) {
    return null;
  }
  
  // Check confidence scores
  if (leftShoulder.score < 0.5 || rightShoulder.score < 0.5) {
    return null;
  }
  
  // Calculate swivel angle using Y-Z plane (horizontal rotation)
  const dx = rightShoulder.position[0] - leftShoulder.position[0];
  const dy = rightShoulder.position[1] - leftShoulder.position[1]; // horizontal difference
  const dz = rightShoulder.position[2] - leftShoulder.position[2]; // depth difference
  
  // atan2 returns angle in radians, convert to degrees
  const angleRad = Math.atan2(dz, dx);
  const angleDeg = angleRad * (180 / Math.PI);
  
  return angleDeg;
};

/**
 * Normalize heading to 0-360 range
 */
export const normalizeHeading = (heading: number): number => {
  return ((heading % 360) + 360) % 360;
};

/**
 * Calculate wrapped delta between two headings (handles 360° wrap-around)
 */
export const calculateWrappedDelta = (heading1: number, heading2: number): number => {
  const delta = Math.abs(heading1 - heading2);
  return Math.min(delta, 360 - delta);
};
