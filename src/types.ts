export type Preset = {
  name: string;
  yaw: number;
  pitch: number;
};

export type LightConfig = {
  pos?: [number, number, number];
  color?: string;
  intensity?: number;
};

export type LightsConfig = {
  key?: LightConfig;
  fill?: LightConfig;
  rim?: LightConfig;
  ambient?: { color?: string; intensity?: number };
};
