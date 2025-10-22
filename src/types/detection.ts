// Type definitions for human detection results

export interface BlazePoseKeypoint {
  distance: [number, number, number];  // 3D distance vector in meters relative to body center
  part: string;                         // Body part name (e.g., "nose", "leftShoulder", "rightShoulder")
  position: [number, number, number];   // Scaled pixel coordinates [x, y, z]
  positionRaw: [number, number, number]; // Normalized coordinates [x, y, z] (0-1 range)
  score: number;                        // Confidence score (0-1)
}

export interface FaceDetection {
  box?: [number, number, number, number];
}

export interface BodyDetection {
  keypoints?: BlazePoseKeypoint[];
}

export interface HandDetection {
  keypoints?: Array<[number, number]>;
}

/**
 * Hand gesture types
 */
export type HandGesture = 'fist' | 'open' | 'pointing' | 'relaxed';

/**
 * Enhanced hand detection data with gesture recognition and bounding box
 */
export interface HandDetectionData {
  detected: boolean;                              // True if hand was detected
  boundingBox: [number, number, number, number] | null;  // [minX, minY, maxX, maxY] if hand present
  isFist: boolean;                                // True if hand present and clenched (legacy - kept for compatibility)
  gesture: HandGesture;                           // Recognized gesture type
}

export interface HumanResult {
  face?: FaceDetection[];
  body?: BodyDetection[];
  hand?: HandDetection[];
  // Enhanced hand detection data
  leftHand: HandDetectionData;
  rightHand: HandDetectionData;
}

export interface CachedSkeletonParts {
  face: FaceDetection[] | null;
  body: BodyDetection[] | null;
  hand: HandDetection[] | null;
}
