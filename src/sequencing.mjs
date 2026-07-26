import { clamp } from "./motion.mjs";

export function bloomFrame(elapsedMs, ringFrame, finalFrame, durationMs) {
  const progress = clamp(elapsedMs / durationMs, 0, 1);
  return Math.round(ringFrame + (finalFrame - ringFrame) * progress);
}

export function afterimageFrames(currentFrame, count) {
  const frames = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const frame = currentFrame - offset;
    if (frame < 0) break;
    frames.push(frame);
  }
  return frames;
}

export function playbackDuration(sourceDurationSeconds, rate = 1) {
  return Math.round((sourceDurationSeconds * 900) / rate);
}
