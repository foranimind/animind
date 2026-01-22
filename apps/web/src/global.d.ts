declare module "*.css";

declare module "three/examples/jsm/loaders/BVHLoader" {
  import type { AnimationClip, Loader, Skeleton } from "three";

  export class BVHLoader extends Loader {
    load(
      url: string,
      onLoad: (result: { skeleton: Skeleton; clip: AnimationClip }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(data: string): { skeleton: Skeleton; clip: AnimationClip };
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader" {
  import type { AnimationClip, Loader, LoadingManager, Scene } from "three";

  export type GLTF = {
    scene: Scene;
    scenes: Scene[];
    animations: AnimationClip[];
    cameras: Array<unknown>;
    asset: Record<string, unknown>;
    parser: unknown;
    userData: Record<string, unknown>;
  };

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(
      data: string | ArrayBuffer,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}

declare module "three/examples/jsm/utils/SkeletonUtils" {
  import type { AnimationClip, Object3D, Skeleton } from "three";

  export const clone: <T extends Object3D>(source: T) => T;
  export const retargetClip: (
    target: Object3D,
    source: Object3D | Skeleton,
    clip: AnimationClip,
    options?: Record<string, unknown>
  ) => AnimationClip;
}
