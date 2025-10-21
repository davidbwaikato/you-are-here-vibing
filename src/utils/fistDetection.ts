// Fist detection utilities

/**
 * Detect if a hand is making a clenched fist gesture
 * Based on finger curl analysis using hand landmarks
 */
export const isFistClenched = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  // Hand landmark indices (MediaPipe Hands format):
  // 0: Wrist
  // 1-4: Thumb (1=CMC, 2=MCP, 3=IP, 4=Tip)
  // 5-8: Index (5=MCP, 6=PIP, 7=DIP, 8=Tip)
  // 9-12: Middle (9=MCP, 10=PIP, 11=DIP, 12=Tip)
  // 13-16: Ring (13=MCP, 14=PIP, 15=DIP, 16=Tip)
  // 17-20: Pinky (17=MCP, 18=PIP, 19=DIP, 20=Tip)

  const wrist = keypoints[0];
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
    // Use a ratio threshold to account for different hand sizes
    const curlRatio = tipToPalmDist / mcpToPalmDist;
    
    // Threshold: fingertip should be at most 1.2x the distance of the knuckle
    // (allows for some variation in curl tightness)
    if (curlRatio < 1.2) {
      curledFingers++;
    }
  }

  // Consider it a fist if at least 3 out of 4 fingers are curled
  // (allows for slight variations in hand pose)
  return curledFingers >= 3;
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
