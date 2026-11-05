// Deterministic glTF loading for Remotion: one fetch per URL (module cache), delayRender until parsed AND drawn.
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cancelRender, continueRender, delayRender, staticFile, useRemotionEnvironment } from "remotion";
import { useThree } from "@react-three/fiber";

const pending = new Map<string, Promise<GLTF>>();
const done = new Map<string, GLTF>();

export const loadGltf = (url: string): Promise<GLTF> => {
  let p = pending.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).then((g) => {
      done.set(url, g);
      return g;
    });
    pending.set(url, p);
  }
  return p;
};

export const modelUrl = (file: string) => (file.startsWith("http") || file.startsWith("/") ? file : staticFile(file));

/**
 * Returns the parsed glTF (null on the first render while it loads). Must be used inside <ThreeCanvas>.
 * The render is held until the model is committed and the canvas redrawn (ThreeCanvas renders with frameloop "never").
 */
export const useGltf = (file: string): GLTF | null => {
  const url = modelUrl(file);
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();
  const [g, setG] = useState<GLTF | null>(() => done.get(url) ?? null);
  const [handle] = useState(() => (done.has(url) ? null : delayRender(`gltf ${url}`, { timeoutInMilliseconds: 120000 })));
  useEffect(() => {
    if (g) return;
    let live = true;
    loadGltf(url).then(
      (x) => {
        if (live) setG(x);
      },
      (e) => cancelRender(e),
    );
    return () => {
      live = false;
    };
  }, [g, url]);
  useEffect(() => {
    if (!g) return;
    if (isRendering) advance(performance.now());
    else invalidate();
    if (handle !== null) continueRender(handle);
  }, [g, handle, isRendering, advance, invalidate]);
  return g;
};

/** Find a clip by name (glTF exports often prefix "Armature|"). */
export const findClip = (clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined =>
  clips.find((c) => c.name === name) ?? clips.find((c) => c.name.endsWith("|" + name)) ?? clips.find((c) => c.name.toLowerCase().endsWith(name.toLowerCase()));
