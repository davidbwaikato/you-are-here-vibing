// Gesture detection utilities

import { HandGesture } from '@/types/detection';

/**
 * Detect if a hand is making a clenched fist gesture
 * Based on finger curl analysis using hand landmarks
 */
export const isFistClenched = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  const palmBase = keypoints[0]; // Use wrist as palm reference

  // Check each finger (index, middle, ring, pinky) - skip thumb as it curls differently
  const fingers = [
    { mcp: 5, tip: 8, name: 'index' },    // Index finger
    { mcp: 9, tip: 12, name: 'middle' },  // Middle finger
    { mcp: 13, tip: 16, name: 'ring' },   // Ring finger
    { mcp: 17, tip: 20, name: 'pinky' },  // Pinky finger
  ];

  let curledFingers = 0;

  for (const finger of fingers) {
    const mcp = keypoints[finger.mcp]; // Knuckle (base of finger)
    const tip = keypoints[finger.tip]; // Fingertip

    // Calculate distance from fingertip to palm base
    const tipToPalmDist = Math.sqrt(
      Math.pow(tip[0] - palmBase[0], 2) + Math.pow(tip[1] - palmBase[1], 2)
    );

    // Calculate distance from knuckle to palm base
    const mcpToPalmDist = Math.sqrt(
      Math.pow(mcp[0] - palmBase[0], 2) + Math.pow(mcp[1] - palmBase[1], 2)
    );

    // If fingertip is closer to palm than knuckle, finger is curled
    const curlRatio = tipToPalmDist / mcpToPalmDist;
    
    if (curlRatio < 1.2) {
      curledFingers++;
    }
  }

  // Consider it a fist if at least 3 out of 4 fingers are curled
  return curledFingers >= 3;
};

/**
 * Detect if a hand is in a fully open position
 * All fingers should be extended away from the palm
 */
export const isOpenHand = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  const palmBase = keypoints[0]; // Wrist as palm reference

  // Check all five fingers including thumb
  const fingers = [
    { mcp: 1, tip: 4, name: 'thumb' },    // Thumb
    { mcp: 5, tip: 8, name: 'index' },    // Index finger
    { mcp: 9, tip: 12, name: 'middle' },  // Middle finger
    { mcp: 13, tip: 16, name: 'ring' },   // Ring finger
    { mcp: 17, tip: 20, name: 'pinky' },  // Pinky finger
  ];

  let extendedFingers = 0;

  for (const finger of fingers) {
    const mcp = keypoints[finger.mcp]; // Base of finger
    const tip = keypoints[finger.tip]; // Fingertip

    // Calculate distance from fingertip to palm base
    const tipToPalmDist = Math.sqrt(
      Math.pow(tip[0] - palmBase[0], 2) + Math.pow(tip[1] - palmBase[1], 2)
    );

    // Calculate distance from knuckle to palm base
    const mcpToPalmDist = Math.sqrt(
      Math.pow(mcp[0] - palmBase[0], 2) + Math.pow(mcp[1] - palmBase[1], 2)
    );

    // If fingertip is significantly farther from palm than knuckle, finger is extended
    const extensionRatio = tipToPalmDist / mcpToPalmDist;
    
    // Threshold: fingertip should be at least 1.5x the distance of the knuckle
    if (extensionRatio > 1.5) {
      extendedFingers++;
    }
  }

  // Consider it an open hand if at least 4 out of 5 fingers are extended
  return extendedFingers >= 4;
};

/**
 * Detect if a hand is pointing with index finger
 * Index finger extended, other fingers curled
 */
export const isPointing = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  const palmBase = keypoints[0]; // Wrist as palm reference

  // Check index finger extension
  const indexMcp = keypoints[5];
  const indexTip = keypoints[8];
  
  const indexTipDist = Math.sqrt(
    Math.pow(indexTip[0] - palmBase[0], 2) + Math.pow(indexTip[1] - palmBase[1], 2)
  );
  const indexMcpDist = Math.sqrt(
    Math.pow(indexMcp[0] - palmBase[0], 2) + Math.pow(indexMcp[1] - palmBase[1], 2)
  );
  const indexExtensionRatio = indexTipDist / indexMcpDist;

  // Index finger must be extended
  if (indexExtensionRatio < 1.5) {
    return false;
  }

  // Check that other fingers (middle, ring, pinky) are curled
  const otherFingers = [
    { mcp: 9, tip: 12, name: 'middle' },  // Middle finger
    { mcp: 13, tip: 16, name: 'ring' },   // Ring finger
    { mcp: 17, tip: 20, name: 'pinky' },  // Pinky finger
  ];

  let curledFingers = 0;

  for (const finger of otherFingers) {
    const mcp = keypoints[finger.mcp];
    const tip = keypoints[finger.tip];

    const tipDist = Math.sqrt(
      Math.pow(tip[0] - palmBase[0], 2) + Math.pow(tip[1] - palmBase[1], 2)
    );
    const mcpDist = Math.sqrt(
      Math.pow(mcp[0] - palmBase[0], 2) + Math.pow(mcp[1] - palmBase[1], 2)
    );
    const curlRatio = tipDist / mcpDist;

    // Finger is curled if tip is close to palm
    if (curlRatio < 1.2) {
      curledFingers++;
    }
  }

  // Consider it pointing if index is extended and at least 2 other fingers are curled
  return curledFingers >= 2;
};

/**
 * Recognize the current hand gesture from keypoints
 * Returns the most confident gesture match, or Relaxed if no clear match
 */
export const recognizeGesture = (keypoints: Array<[number, number]>): HandGesture => {
  if (!keypoints || keypoints.length < 21) {
    return HandGesture.Relaxed;
  }

  // Check gestures in order of specificity (most specific first)
  // This ensures mutually exclusive detection
  
  // 1. Check for pointing (most specific - one finger extended)
  if (isPointing(keypoints)) {
    return HandGesture.Pointing;
  }

  // 2. Check for fist (all fingers curled)
  if (isFistClenched(keypoints)) {
    return HandGesture.Fist;
  }

  // 3. Check for open hand (all fingers extended)
  if (isOpenHand(keypoints)) {
    return HandGesture.OpenHand;
  }

  // 4. Default to relaxed if no clear gesture detected
  return HandGesture.Relaxed;
};

/**
 * Calculate bounding box coordinates for a hand
 * Returns [minX, minY, maxX, maxY] with padding
 */
export const calculateHandBoundingBox = (
  keypoints: Array<[number, number]>,
  padding: number = 20
): [number, number, number, number] | null => {
  if (!keypoints || keypoints.length === 0) {
    return null;
  }

  // Find min/max coordinates across all keypoints
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  keypoints.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  // Add padding
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return [minX, minY, maxX, maxY];
};

/**
 * Get emoji representation of a gesture for logging
 */
export const getGestureEmoji = (gesture: HandGesture): string => {
  switch (gesture) {
    case HandGesture.Fist:
      return '👊';
    case HandGesture.OpenHand:
      return '✋';
    case HandGesture.Pointing:
      return '☝️';
    case HandGesture.Relaxed:
      return '🤚';
    default:
      return '❓';
  }
};
