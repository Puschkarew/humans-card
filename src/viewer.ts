import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LightsConfig, Preset } from "./types";
import { clamp, isWebGLAvailable, lerp } from "./utils";
import { DEFAULT_PRESETS } from "./presets";

export type ViewerElements = {
  container: HTMLElement;
  hintEl: HTMLElement;
  loaderEl: HTMLElement;
  fallbackEl: HTMLImageElement;
};

const DEFAULT_BACKGROUND =
  "radial-gradient(120% 120% at 50% 30%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.0) 45%), linear-gradient(180deg, #101014 0%, #0b0b0f 100%)";

const DEFAULT_LIGHTS: Required<LightsConfig> = {
  key: { pos: [2.5, 2.0, 3.0], color: "#ffffff", intensity: 1.2 },
  fill: { pos: [-2.0, 1.0, 2.5], color: "#cfd8ff", intensity: 0.6 },
  rim: { pos: [0.0, 2.5, -3.0], color: "#ffffff", intensity: 0.8 },
  ambient: { color: "#ffffff", intensity: 0.2 }
};

const DEFAULT_DISTANCE = 2.8;
const MIN_DISTANCE = 1.8;
const MAX_DISTANCE = 4.5;

export class Viewer {
  private container: HTMLElement;
  private hintEl: HTMLElement;
  private loaderEl: HTMLElement;
  private fallbackEl: HTMLImageElement;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private modelGroup: THREE.Group | null = null;

  private keyLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private animationHandle: number | null = null;

  private presets: Preset[] = DEFAULT_PRESETS;
  private currentYaw = 0;
  private currentPitch = 0;
  private distance = DEFAULT_DISTANCE;
  private zoomEnabled = true;
  private currentVariant: string | null = null;

  private dragging = false;
  private pinchDistance = 0;
  private pointers = new Map<number, { x: number; y: number }>();

  private snap: {
    active: boolean;
    startYaw: number;
    startPitch: number;
    targetYaw: number;
    targetPitch: number;
    startTime: number;
    duration: number;
  } = {
    active: false,
    startYaw: 0,
    startPitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    startTime: 0,
    duration: 450
  };

  private variantMaterialsKHR = new Map<string, Map<string, THREE.Material>>();
  private variantMaterialsByName = new Map<string, Map<string, THREE.Material>>();
  private originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();

  constructor(elements: ViewerElements) {
    this.container = elements.container;
    this.hintEl = elements.hintEl;
    this.loaderEl = elements.loaderEl;
    this.fallbackEl = elements.fallbackEl;

    this.container.style.background = DEFAULT_BACKGROUND;

    if (!isWebGLAvailable()) {
      this.showFallback("WebGL not available");
      return;
    }

    this.initThree();
    this.initLights(DEFAULT_LIGHTS);
    this.initEvents();
    this.startRenderLoop();
    this.loadDefaultCube();
  }

  setBackground(value: string | null): void {
    this.container.style.background = value && value.trim().length > 0 ? value : DEFAULT_BACKGROUND;
  }

  setZoomEnabled(enabled: boolean): void {
    this.zoomEnabled = enabled;
  }

  setPresets(presets: Preset[]): void {
    this.presets = presets.length > 0 ? presets : DEFAULT_PRESETS;
  }

  setPreset(name: string): void {
    const preset = this.presets.find((p) => p.name === name);
    if (!preset) return;
    this.startSnapTo(preset.yaw, preset.pitch);
  }

  setLights(config: LightsConfig): void {
    const merged: Required<LightsConfig> = {
      key: { ...DEFAULT_LIGHTS.key, ...(config.key ?? {}) },
      fill: { ...DEFAULT_LIGHTS.fill, ...(config.fill ?? {}) },
      rim: { ...DEFAULT_LIGHTS.rim, ...(config.rim ?? {}) },
      ambient: { ...DEFAULT_LIGHTS.ambient, ...(config.ambient ?? {}) }
    };
    if (this.keyLight) this.applyDirectionalLight(this.keyLight, merged.key);
    if (this.fillLight) this.applyDirectionalLight(this.fillLight, merged.fill);
    if (this.rimLight) this.applyDirectionalLight(this.rimLight, merged.rim);
    if (this.ambientLight) {
      this.ambientLight.color = new THREE.Color(merged.ambient.color);
      this.ambientLight.intensity = merged.ambient.intensity;
    }
  }

  async setSrc(src: string | null): Promise<void> {
    if (!this.scene || !this.camera || !this.renderer) return;

    if (!src || src.trim().length === 0) {
      this.loadDefaultCube();
      return;
    }

    this.fallbackEl.style.display = "none";
    this.showLoader(true);
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(src);

      this.clearModel();
      this.modelGroup = new THREE.Group();
      this.scene.add(this.modelGroup);

      this.modelGroup.add(gltf.scene);
      this.normalizeModel(gltf.scene);

      await this.prepareVariants(gltf);
      this.showLoader(false);
    } catch (error) {
      console.error("Failed to load GLB", error);
      this.showLoader(false);
      this.showFallback("Failed to load model");
    }
  }

  setVariant(name: string): void {
    if (!this.modelGroup) return;
    const variant = name.trim();
    if (variant.length === 0) {
      this.currentVariant = null;
      this.restoreOriginalMaterials();
      return;
    }

    if (this.variantMaterialsKHR.has(variant)) {
      this.applyVariantFromKHR(variant);
      this.currentVariant = variant;
      return;
    }

    if (this.variantMaterialsByName.has(variant)) {
      this.applyVariantFromName(variant);
      this.currentVariant = variant;
      return;
    }

    this.currentVariant = null;
    this.restoreOriginalMaterials();
  }

  getState(): {
    preset: string | null;
    variant: string | null;
    yaw: number;
    pitch: number;
    distance: number;
  } {
    return {
      preset: this.findNearestPreset()?.name ?? null,
      variant: this.currentVariant,
      yaw: this.currentYaw,
      pitch: this.currentPitch,
      distance: this.distance
    };
  }

  dispose(): void {
    this.stopRenderLoop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerup", this.onPointerUp);
    this.container.removeEventListener("pointercancel", this.onPointerUp);
    this.container.removeEventListener("wheel", this.onWheel);
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.modelGroup = null;
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, this.distance);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.physicallyCorrectLights = true;

    this.container.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();
  }

  private initLights(config: Required<LightsConfig>): void {
    if (!this.scene) return;

    this.keyLight = new THREE.DirectionalLight(
      new THREE.Color(config.key.color),
      config.key.intensity
    );
    this.fillLight = new THREE.DirectionalLight(
      new THREE.Color(config.fill.color),
      config.fill.intensity
    );
    this.rimLight = new THREE.DirectionalLight(
      new THREE.Color(config.rim.color),
      config.rim.intensity
    );
    this.ambientLight = new THREE.AmbientLight(
      new THREE.Color(config.ambient.color),
      config.ambient.intensity
    );

    this.applyDirectionalLight(this.keyLight, config.key);
    this.applyDirectionalLight(this.fillLight, config.fill);
    this.applyDirectionalLight(this.rimLight, config.rim);

    this.scene.add(this.keyLight, this.fillLight, this.rimLight, this.ambientLight);
  }

  private applyDirectionalLight(light: THREE.DirectionalLight, config: Required<LightsConfig>["key"]): void {
    light.position.set(config.pos[0], config.pos[1], config.pos[2]);
    light.color = new THREE.Color(config.color);
    light.intensity = config.intensity;
  }

  private initEvents(): void {
    this.container.addEventListener("pointerdown", this.onPointerDown);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerup", this.onPointerUp);
    this.container.addEventListener("pointercancel", this.onPointerUp);
    this.container.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.renderer) return;
    this.container.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.dragging = true;
      this.snap.active = false;
      this.hintEl.classList.add("is-hidden");
      this.container.classList.add("is-dragging");
    }

    if (this.pointers.size === 2) {
      const points = Array.from(this.pointers.values());
      this.pinchDistance = this.distanceBetween(points[0], points[1]);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.renderer) return;
    if (!this.pointers.has(event.pointerId)) return;

    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1 && this.dragging) {
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;

      const sensitivity = 0.005;
      this.currentYaw += dx * sensitivity;
      this.currentPitch = this.wrapAngle(this.currentPitch + dy * sensitivity);
      this.updateModelRotation();
    }

    if (this.pointers.size === 2 && this.zoomEnabled) {
      const points = Array.from(this.pointers.values());
      const nextDistance = this.distanceBetween(points[0], points[1]);
      const delta = nextDistance - this.pinchDistance;
      if (Math.abs(delta) > 0.5) {
        this.updateDistance(this.distance - delta * 0.01);
        this.pinchDistance = nextDistance;
      }
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.renderer) return;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0 && this.dragging) {
      this.dragging = false;
      this.container.classList.remove("is-dragging");
      const preset = this.findNearestPreset();
      if (preset) this.startSnapTo(preset.yaw, preset.pitch);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.zoomEnabled) return;
    event.preventDefault();
    this.updateDistance(this.distance + event.deltaY * 0.003);
  };

  private distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  private updateDistance(next: number): void {
    this.distance = clamp(next, MIN_DISTANCE, MAX_DISTANCE);
    if (this.camera) {
      this.camera.position.set(0, 0, this.distance);
      this.camera.updateProjectionMatrix();
    }
  }

  private findNearestPreset(): Preset | null {
    if (this.presets.length === 0) return null;
    let nearest = this.presets[0];
    let minDist = Number.POSITIVE_INFINITY;
    for (const preset of this.presets) {
      const dyaw = this.wrapAngle(this.currentYaw - preset.yaw);
      const dpitch = this.currentPitch - preset.pitch;
      const dist = Math.hypot(dyaw, dpitch);
      if (dist < minDist) {
        minDist = dist;
        nearest = preset;
      }
    }
    return nearest;
  }

  private wrapAngle(angle: number): number {
    const twoPi = Math.PI * 2;
    let wrapped = angle % twoPi;
    if (wrapped > Math.PI) wrapped -= twoPi;
    if (wrapped < -Math.PI) wrapped += twoPi;
    return wrapped;
  }

  private startSnapTo(yaw: number, pitch: number): void {
    this.snap = {
      active: true,
      startYaw: this.currentYaw,
      startPitch: this.currentPitch,
      targetYaw: yaw,
      targetPitch: pitch,
      startTime: performance.now(),
      duration: 450
    };
  }

  private updateSnap(): void {
    if (!this.snap.active) return;
    const now = performance.now();
    const t = clamp((now - this.snap.startTime) / this.snap.duration, 0, 1);
    const ease = t * (2 - t);
    this.currentYaw = lerp(this.snap.startYaw, this.snap.targetYaw, ease);
    this.currentPitch = lerp(this.snap.startPitch, this.snap.targetPitch, ease);
    this.updateModelRotation();
    if (t >= 1) this.snap.active = false;
  }

  private updateModelRotation(): void {
    if (!this.modelGroup) return;
    this.modelGroup.rotation.y = this.currentYaw;
    this.modelGroup.rotation.x = this.currentPitch;
  }

  private startRenderLoop(): void {
    const render = () => {
      this.updateSnap();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animationHandle = requestAnimationFrame(render);
    };
    this.animationHandle = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private showLoader(show: boolean): void {
    this.loaderEl.classList.toggle("is-visible", show);
  }

  private showFallback(reason: string): void {
    console.warn(reason);
    this.fallbackEl.style.display = "block";
    this.loaderEl.classList.remove("is-visible");
    this.hintEl.classList.add("is-hidden");
  }

  private loadDefaultCube(): void {
    if (!this.scene) return;
    this.clearModel();
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: "#8aa0ff",
      metalness: 0.25,
      roughness: 0.35
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.modelGroup.add(mesh);
    this.showLoader(false);
  }

  private clearModel(): void {
    if (!this.scene || !this.modelGroup) return;
    this.scene.remove(this.modelGroup);
    this.modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else if (material) {
          material.dispose();
        }
      }
    });
    this.modelGroup = null;
    this.variantMaterialsKHR.clear();
    this.variantMaterialsByName.clear();
    this.originalMaterials.clear();
    this.currentVariant = null;
  }

  private normalizeModel(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!sphere || sphere.radius === 0) return;
    const scale = 1 / sphere.radius;
    model.scale.setScalar(scale);
    model.position.copy(sphere.center).multiplyScalar(-scale);
  }

  private async prepareVariants(gltf: { scene: THREE.Object3D; parser: any; userData?: any }): Promise<void> {
    this.variantMaterialsKHR.clear();
    this.variantMaterialsByName.clear();
    this.originalMaterials.clear();

    const variantNames: string[] =
      gltf.parser?.json?.extensions?.KHR_materials_variants?.variants?.map(
        (v: { name: string }) => v.name
      ) ?? [];

    const promises: Promise<void>[] = [];

    gltf.scene.traverse((node: THREE.Object3D) => {
      if (!(node instanceof THREE.Mesh)) return;
      this.originalMaterials.set(node.uuid, node.material);

      const ext = node.userData?.gltfExtensions?.KHR_materials_variants;
      if (ext?.mappings && Array.isArray(ext.mappings)) {
        for (const mapping of ext.mappings) {
          if (!Array.isArray(mapping.variants)) continue;
          for (const variantIndex of mapping.variants) {
            const name = variantNames[variantIndex];
            if (!name) continue;
            const promise = gltf.parser
              .getDependency("material", mapping.material)
              .then((material: THREE.Material) => {
                if (!this.variantMaterialsKHR.has(name)) {
                  this.variantMaterialsKHR.set(name, new Map());
                }
                this.variantMaterialsKHR.get(name)?.set(node.uuid, material);
              });
            promises.push(promise);
          }
        }
      }

      const material = node.material;
      if (!Array.isArray(material)) {
        const variant = this.extractVariantName(material.name);
        if (variant) {
          if (!this.variantMaterialsByName.has(variant)) {
            this.variantMaterialsByName.set(variant, new Map());
          }
          this.variantMaterialsByName.get(variant)?.set(node.uuid, material);
        }
      }
    });

    await Promise.all(promises);
  }

  private extractVariantName(name: string): string | null {
    if (!name) return null;
    const parts = name.split("__");
    if (parts.length < 2) return null;
    return parts[parts.length - 1].trim();
  }

  private applyVariantFromKHR(name: string): void {
    if (!this.modelGroup) return;
    const variantMap = this.variantMaterialsKHR.get(name);
    if (!variantMap) return;
    this.modelGroup.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const material = variantMap.get(node.uuid);
      if (material) {
        node.material = material;
      } else {
        const original = this.originalMaterials.get(node.uuid);
        if (original) node.material = original;
      }
    });
  }

  private applyVariantFromName(name: string): void {
    if (!this.modelGroup) return;
    const variantMap = this.variantMaterialsByName.get(name);
    if (!variantMap) return;
    this.modelGroup.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const material = variantMap.get(node.uuid);
      if (material) {
        node.material = material;
      }
    });
  }

  private restoreOriginalMaterials(): void {
    if (!this.modelGroup) return;
    this.modelGroup.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const original = this.originalMaterials.get(node.uuid);
      if (original) node.material = original;
    });
  }
}
