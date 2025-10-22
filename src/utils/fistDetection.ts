// Hand gesture detection utilities

/**
 * Gesture types that can be detected
 */
export type HandGesture = 'fist' | 'open' | 'pointing' | 'relaxed';

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
 * Detect if a hand is fully open (all fingers extended)
 * Based on finger extension analysis using hand landmarks
 */
export const isHandOpen = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  const palmBase = keypoints[0]; // Use wrist as palm reference

  // Check all fingers including thumb
  const fingers = [
    { mcp: 1, tip: 4, name: 'thumb' },    // Thumb (use CMC as base)
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

    // Calculate distance from base to palm base
    const mcpToPalmDist = Math.sqrt(
      Math.pow(mcp[0] - palmBase[0], 2) + Math.pow(mcp[1] - palmBase[1], 2)
    );

    // If fingertip is farther from palm than base, finger is extended
    // Use a ratio threshold to account for different hand sizes
    const extensionRatio = tipToPalmDist / mcpToPalmDist;
    
    // Threshold: fingertip should be at least 1.5x the distance of the base
    // (stricter than fist detection to ensure clear extension)
    if (extensionRatio >= 1.5) {
      extendedFingers++;
    }
  }

  // Consider it open if at least 4 out of 5 fingers are extended
  // (allows for slight variations in hand pose)
  return extendedFingers >= 4;
};

/**
 * Detect if a hand is pointing (index finger extended, other fingers curled)
 * Based on selective finger extension analysis using hand landmarks
 */
export const isHandPointing = (keypoints: Array<[number, number]>): boolean => {
  if (!keypoints || keypoints.length < 21) {
    return false;
  }

  const palmBase = keypoints[0]; // Use wrist as palm reference

  // Check index finger extension
  const indexMcp = keypoints[5];
  const indexTip = keypoints[8];
  
  const indexTipToPalmDist = Math.sqrt(
    Math.pow(indexTip[0] - palmBase[0], 2) + Math.pow(indexTip[1] - palmBase[1], 2)
  );
  
  const indexMcpToPalmDist = Math.sqrt(
    Math.pow(indexMcp[0] - palmBase[0], 2) + Math.pow(indexMcp[1] - palmBase[1], 2)
  );
  
  const indexExtensionRatio = indexTipToPalmDist / indexMcpToPalmDist;
  
  // Index finger must be extended (same threshold as open hand)
  const isIndexExtended = indexExtensionRatio >= 1.5;
  
  if (!isIndexExtended) {
    return false;
  }

  // Check other fingers (middle, ring, pinky) are curled
  const otherFingers = [
    { mcp: 9, tip: 12, name: 'middle' },  // Middle finger
    { mcp: 13, tip: 16, name: 'ring' },   // Ring finger
    { mcp: 17, tip: 20, name: 'pinky' },  // Pinky finger
  ];

  let curledFingers = 0;

  for (const finger of otherFingers) {
    const mcp = keypoints[finger.mcp];
    const tip = keypoints[finger.tip];

    const tipToPalmDist = Math.sqrt(
      Math.pow(tip[0] - palmBase[0], 2) + Math.pow(tip[1] - palmBase[1], 2)
    );

    const mcpToPalmDist = Math.sqrt(
      Math.pow(mcp[0] - palmBase[0], 2) + Math.pow(mcp[1] - palmBase[1], 2)
    );

    const curlRatio = tipToPalmDist / mcpToPalmDist;
    
    // Same curl threshold as fist detection
    if (curlRatio < 1.2) {
      curledFingers++;
    }
  }

  // Consider it pointing if index is extended and at least 2 out of 3 other fingers are curled
  // (thumb position is flexible)
  return curledFingers >= 2;
};

/**
 * Classify hand gesture based on keypoints
 * Priority: pointing > fist > open > relaxed
 * 
 * @param keypoints Hand landmark keypoints
 * @returns Detected gesture type
 */
export const classifyHandGesture = (keypoints: Array<[number, number]> | undefined): HandGesture => {
  if (!keypoints || keypoints.length < 21) {
    return 'relaxed';
  }

  // Check gestures in priority order
  // Priority: pointing > fist (as specified)
  
  if (isHandPointing(keypoints)) {
    return 'pointing';
  }
  
  if (isFistClenched(keypoints)) {
    return 'fist';
  }
  
  if (isHandOpen(keypoints)) {
    return 'open';
  }
  
  // Default fallback
  return 'relaxed';
};

/**
 * Temporal gesture buffer for smoothing noisy detection
 */
export class GestureBuffer {
  private buffer: HandGesture[] = [];
  private readonly bufferSize: number;
  private readonly confirmationThreshold: number;
  private currentGesture: HandGesture = 'relaxed';

  /**
   * @param bufferSize Number of frames to keep in buffer (default: 5)
   * @param confirmationThreshold Number of consistent non-'relaxed' frames required to confirm gesture (default: 3)
   */
  constructor(bufferSize: number = 5, confirmationThreshold: number = 3) {
    this.bufferSize = bufferSize;
    this.confirmationThreshold = confirmationThreshold;
  }

  /**
   * Add a new gesture sample to the buffer
   * @param gesture Detected gesture for current frame
   * @returns Updated confirmed gesture (may be unchanged)
   */
  addSample(gesture: HandGesture): HandGesture {
    // Add to buffer
    this.buffer.push(gesture);
    
    // Keep buffer at fixed size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Count occurrences of each non-'relaxed' gesture in buffer
    const gestureCounts: Record<HandGesture, number> = {
      fist: 0,
      open: 0,
      pointing: 0,
      relaxed: 0,
    };

    this.buffer.forEach(g => {
      gestureCounts[g]++;
    });

    // Find most common non-'relaxed' gesture
    let maxCount = 0;
    let dominantGesture: HandGesture = 'relaxed';

    // Check in priority order: pointing > fist > open
    const priorityOrder: HandGesture[] = ['pointing', 'fist', 'open'];
    
    for (const g of priorityOrder) {
      if (gestureCounts[g] > maxCount) {
        maxCount = gestureCounts[g];
        dominantGesture = g;
      }
    }

    // Update current gesture if we have enough consistent samples
    if (maxCount >= this.confirmationThreshold && dominantGesture !== 'relaxed') {
      if (this.currentGesture !== dominantGesture) {
        const previousGesture = this.currentGesture;
        this.currentGesture = dominantGesture;
        
        console.log('[Gesture Recognition] 🖐️ Gesture changed:', {
          from: previousGesture,
          to: dominantGesture,
          confirmationCount: maxCount,
          threshold: this.confirmationThreshold,
          bufferState: gestureCounts,
        });
      }
    }

    return this.currentGesture;
  }

  /**
   * Get current confirmed gesture
   */
  getCurrentGesture(): HandGesture {
    return this.currentGesture;
  }

  /**
   * Reset buffer and current gesture
   */
  reset(): void {
    this.buffer = [];
    this.currentGesture = 'relaxed';
    console.log('[Gesture Recognition] 🔄 Buffer reset to relaxed state');
  }

  /**
   * Get buffer state for debugging
   */
  getBufferState(): { buffer: HandGesture[]; current: HandGesture } {
    return {
      buffer: [...this.buffer],
      current: this.currentGesture,
    };
  }
}

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
