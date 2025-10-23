// Detection types

export enum HandGesture {
  Fist = 'Fist',
  OpenHand = 'OpenHand',
  Pointing = 'Pointing',
  Relaxed = 'Relaxed',
}

export interface HandDetectionData {
  detected: boolean;
  boundingBox: [number, number, number, number] | null; // [minX, minY, maxX, maxY]
  gesture: HandGesture;
  isFist?: boolean; // Add explicit fist flag for backward compatibility
}

export interface HumanResult {
  face?: Array<{ box?: [number, number, number, number] }>;
  body?: Array<{ keypoints?: any[] }>;
  hand?: Array<{ keypoints?: Array<[number, number]> }>;
  leftHand: HandDetectionData;
  rightHand: HandDetectionData;
}

export interface CachedSkeletonParts {
  face: Array<{ box?: [number, number, number, number] }> | null;
  body: Array<{ keypoints?: any[] }> | null;
  hand: Array<{ keypoints?: Array<[number, number]> }> | null;
}
