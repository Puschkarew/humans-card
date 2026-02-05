import type { LightsConfig, Preset } from "./types";
import { HumansViewerElement } from "./element";

export type ViewerCreateOptions = {
  src?: string;
  preset?: string;
  variant?: string;
  background?: string;
  zoom?: boolean;
  fallbackSrc?: string;
  presets?: Preset[];
  lights?: LightsConfig;
};

const TAG_NAME = "humans-viewer";

export function register(): void {
  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, HumansViewerElement);
  }
}

export function create(container: HTMLElement, options: ViewerCreateOptions = {}): HumansViewerElement {
  register();
  const el = document.createElement(TAG_NAME) as HumansViewerElement;

  if (options.src) el.setAttribute("src", options.src);
  if (options.preset) el.setAttribute("preset", options.preset);
  if (options.variant) el.setAttribute("variant", options.variant);
  if (options.background) el.setAttribute("background", options.background);
  if (options.zoom !== undefined) el.setAttribute("zoom", String(options.zoom));
  if (options.fallbackSrc) el.setAttribute("fallback-src", options.fallbackSrc);

  container.appendChild(el);

  if (options.presets) el.setPresets(options.presets);
  if (options.lights) el.setLights(options.lights);

  return el;
}

register();

export { HumansViewerElement };
export type { LightsConfig, Preset };
