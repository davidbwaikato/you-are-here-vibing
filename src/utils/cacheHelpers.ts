// Deep copy helper functions to prevent reference mutation

import { FaceDetection, BodyDetection, HandDetection/*, BlazePoseKeypoint*/ } from '@/types/detection';

export const deepCopyFace = (face: FaceDetection[]): FaceDetection[] => {
  return face.map(f => ({
    box: f.box ? [...f.box] as [number, number, number, number] : undefined
  }));
};

export const deepCopyBody = (body: BodyDetection[]): BodyDetection[] => {
  return body.map(b => ({
    keypoints: b.keypoints?.map(kp => ({
      distance: [...kp.distance] as [number, number, number],
      part: kp.part,
      position: [...kp.position] as [number, number, number],
      positionRaw: [...kp.positionRaw] as [number, number, number],
      score: kp.score
    }))
  }));
};

export const deepCopyHand = (hand: HandDetection[]): HandDetection[] => {
  return hand.map(h => ({
    keypoints: h.keypoints?.map(kp => [...kp] as [number, number])
  }));
};
