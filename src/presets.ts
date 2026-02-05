import type { Preset } from "./types";

export const DEFAULT_PRESETS: Preset[] = [
  { name: "front", yaw: 0, pitch: 0 },
  { name: "back", yaw: Math.PI, pitch: 0 },
  { name: "left", yaw: -Math.PI / 2, pitch: 0 },
  { name: "right", yaw: Math.PI / 2, pitch: 0 }
];
