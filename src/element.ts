import type { LightsConfig, Preset } from "./types";
import { Viewer } from "./viewer";
import { parseBoolean, parseVec3 } from "./utils";

const STYLE_TEXT = `
:host {
  display: block;
  width: 100%;
  height: 100%;
}
.wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}
.wrapper.is-dragging {
  cursor: grabbing;
}
canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  z-index: 1;
}
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.35);
  border-radius: 999px;
  opacity: 1;
  transition: opacity 0.3s ease;
}
.hint.is-hidden {
  opacity: 0;
}
.loader {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 255, 255, 0.9);
  transform: translate(-50%, -50%);
  animation: spin 1s linear infinite;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.loader.is-visible {
  opacity: 1;
}
.fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}
@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
`;

export class HumansViewerElement extends HTMLElement {
  private viewer: Viewer | null = null;
  private wrapper: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private loaderEl: HTMLDivElement;
  private fallbackEl: HTMLImageElement;

  static get observedAttributes(): string[] {
    return [
      "src",
      "preset",
      "variant",
      "background",
      "zoom",
      "fallback-src",
      "light-key-pos",
      "light-key-color",
      "light-key-intensity",
      "light-fill-pos",
      "light-fill-color",
      "light-fill-intensity",
      "light-rim-pos",
      "light-rim-color",
      "light-rim-intensity",
      "light-ambient-color",
      "light-ambient-intensity"
    ];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLE_TEXT;

    this.wrapper = document.createElement("div");
    this.wrapper.className = "wrapper";

    const overlay = document.createElement("div");
    overlay.className = "overlay";

    this.hintEl = document.createElement("div");
    this.hintEl.className = "hint";
    this.hintEl.textContent = "Drag to rotate";

    this.loaderEl = document.createElement("div");
    this.loaderEl.className = "loader";

    this.fallbackEl = document.createElement("img");
    this.fallbackEl.className = "fallback";
    this.fallbackEl.alt = "3D preview";

    overlay.append(this.hintEl, this.loaderEl, this.fallbackEl);
    this.wrapper.appendChild(overlay);
    shadow.append(style, this.wrapper);
  }

  connectedCallback(): void {
    if (this.viewer) return;
    this.viewer = new Viewer({
      container: this.wrapper,
      hintEl: this.hintEl,
      loaderEl: this.loaderEl,
      fallbackEl: this.fallbackEl
    });
    this.applyInitialAttributes();
  }

  disconnectedCallback(): void {
    this.viewer?.dispose();
    this.viewer = null;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (!this.viewer) return;

    switch (name) {
      case "src":
        this.viewer.setSrc(newValue);
        break;
      case "preset":
        if (newValue) this.viewer.setPreset(newValue);
        break;
      case "variant":
        if (newValue) {
          this.viewer.setVariant(newValue);
        } else {
          this.viewer.setVariant("");
        }
        break;
      case "background":
        this.viewer.setBackground(newValue);
        break;
      case "zoom":
        this.viewer.setZoomEnabled(parseBoolean(newValue, true));
        break;
      case "fallback-src":
        this.applyFallbackSrc(newValue);
        break;
      default:
        if (name.startsWith("light-")) {
          this.viewer.setLights(this.readLightsFromAttributes());
        }
        break;
    }
  }

  setPreset(name: string): void {
    this.viewer?.setPreset(name);
  }

  setVariant(name: string): void {
    this.viewer?.setVariant(name);
  }

  setPresets(presets: Preset[]): void {
    this.viewer?.setPresets(presets);
  }

  setLights(config: LightsConfig): void {
    this.viewer?.setLights(config);
  }

  getState(): ReturnType<Viewer["getState"]> | null {
    return this.viewer?.getState() ?? null;
  }

  dispose(): void {
    this.viewer?.dispose();
    this.viewer = null;
  }

  private applyInitialAttributes(): void {
    this.applyFallbackSrc(this.getAttribute("fallback-src"));
    this.viewer?.setBackground(this.getAttribute("background"));
    this.viewer?.setZoomEnabled(parseBoolean(this.getAttribute("zoom"), true));
    this.viewer?.setLights(this.readLightsFromAttributes());
    this.viewer?.setSrc(this.getAttribute("src"));

    const preset = this.getAttribute("preset");
    if (preset) this.viewer?.setPreset(preset);
    const variant = this.getAttribute("variant");
    if (variant) this.viewer?.setVariant(variant);
  }

  private applyFallbackSrc(value: string | null): void {
    if (value && value.trim().length > 0) {
      this.fallbackEl.src = value;
      this.fallbackEl.style.display = "none";
      return;
    }
    this.fallbackEl.removeAttribute("src");
  }

  private readLightsFromAttributes(): LightsConfig {
    const keyPos = parseVec3(this.getAttribute("light-key-pos"));
    const fillPos = parseVec3(this.getAttribute("light-fill-pos"));
    const rimPos = parseVec3(this.getAttribute("light-rim-pos"));

    const keyIntensity = parseFloatSafe(this.getAttribute("light-key-intensity"));
    const fillIntensity = parseFloatSafe(this.getAttribute("light-fill-intensity"));
    const rimIntensity = parseFloatSafe(this.getAttribute("light-rim-intensity"));
    const ambientIntensity = parseFloatSafe(this.getAttribute("light-ambient-intensity"));

    const key: LightsConfig["key"] = {};
    const fill: LightsConfig["fill"] = {};
    const rim: LightsConfig["rim"] = {};
    const ambient: LightsConfig["ambient"] = {};

    if (keyPos) key.pos = keyPos;
    const keyColor = this.getAttribute("light-key-color");
    if (keyColor) key.color = keyColor;
    if (keyIntensity !== undefined) key.intensity = keyIntensity;

    if (fillPos) fill.pos = fillPos;
    const fillColor = this.getAttribute("light-fill-color");
    if (fillColor) fill.color = fillColor;
    if (fillIntensity !== undefined) fill.intensity = fillIntensity;

    if (rimPos) rim.pos = rimPos;
    const rimColor = this.getAttribute("light-rim-color");
    if (rimColor) rim.color = rimColor;
    if (rimIntensity !== undefined) rim.intensity = rimIntensity;

    const ambientColor = this.getAttribute("light-ambient-color");
    if (ambientColor) ambient.color = ambientColor;
    if (ambientIntensity !== undefined) ambient.intensity = ambientIntensity;

    return { key, fill, rim, ambient };
  }
}

function parseFloatSafe(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
