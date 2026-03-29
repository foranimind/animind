import type { Manifest } from "../types/manifest";

export type ManifestAssetKey =
  | "scenePanorama"
  | "motionBvh"
  | "musicWav"
  | "exportMp4"
  | "exportZip";

export type ManifestAssetUris = Record<ManifestAssetKey, string | undefined>;

export type ManifestSummary = {
  title?: string;
  prompt?: string;
  style?: string;
  duration?: number;
  status?: string;
  createdAt?: string;
  thumbnailUri?: string;
};

export const getManifestAssetUris = (manifest?: Manifest | null): ManifestAssetUris => ({
  scenePanorama: manifest?.outputs?.scene?.panorama?.uri,
  motionBvh: manifest?.outputs?.motion?.bvh?.uri,
  musicWav: manifest?.outputs?.music?.wav?.uri,
  exportMp4: manifest?.outputs?.export?.mp4?.uri,
  exportZip: manifest?.outputs?.export?.zip?.uri,
});

export const getManifestSummary = (manifest?: Manifest | null): ManifestSummary => {
  const prompt = manifest?.inputs?.raw_prompt;
  const duration =
    manifest?.inputs?.duration_s ??
    manifest?.outputs?.motion?.duration_s ??
    manifest?.outputs?.music?.duration_s;
  const assets = getManifestAssetUris(manifest);
  return {
    title: prompt,
    prompt,
    style: manifest?.inputs?.style,
    duration,
    status: manifest?.status,
    createdAt: manifest?.created_at,
    thumbnailUri: assets.scenePanorama,
  };
};
