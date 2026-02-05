export function parseVec3(input: string | null): [number, number, number] | null {
  if (!input) return null;
  const normalized = input.replace(/,/g, " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number.parseFloat(p));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return [nums[0], nums[1], nums[2]];
}

export function parseBoolean(input: string | null, defaultValue: boolean): boolean {
  if (input === null) return defaultValue;
  const normalized = input.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return true;
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
