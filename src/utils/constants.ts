// Application constants

// HYSTERESIS THRESHOLD: Minimum angle change required to update Street View heading
// This prevents jittery updates from small shoulder movements
export const HYSTERESIS_HEADING_ANGLE_THRESHOLD = 1.0; // degrees

// VIDEO OVERLAY ALPHA: Global alpha value for blending video with Street View
export const VIDEO_OVERLAY_ALPHA = 0.5; // 50% opacity for subtle blending

// FACIAL KEYPOINT INDICES: BlazePose includes facial landmarks in body keypoints (0-10)
// These should be filtered out to avoid redundant visualization with face detection
export const FACIAL_KEYPOINT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// DETECTION INTERVAL: How often to run detection (in milliseconds)
export const DETECTION_INTERVAL_MS = 50; // ~20fps

// LOGGING INTERVAL: How often to log debug info (every N frames)
export const LOG_INTERVAL_FRAMES = 30;
export const RENDER_LOG_INTERVAL_FRAMES = 120;

// INITIAL STREET VIEW SETTINGS
export const INITIAL_HEADING = 355.84;
export const INITIAL_PITCH = -1.84;

// BLAZEPOSE CONNECTIONS: Body skeleton connections (excluding facial keypoints)
export const BODY_CONNECTIONS = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

// HAND CONNECTIONS: Finger connections for hand skeleton
export const FINGER_CONNECTIONS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];
