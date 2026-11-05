// Image + video textures for in-world screens (the 3D iPhone shows real app screenshots / recordings).
import React, { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { continueRender, delayRender, useRemotionEnvironment } from "remotion";
import { useThree } from "@react-three/fiber";
import { Video } from "@remotion/media";

const imgCache = new Map<string, THREE.Texture>();

/**
 * Load an image (e.g. staticFile("screens/14-guard-active.png")) as a texture. Must be used inside <ThreeCanvas>.
 * Holds the render (delayRender) until the texture is uploaded AND the canvas has re-rendered with it
 * (ThreeCanvas uses frameloop="never" while rendering, so we advance() manually).
 */
export const useImageTexture = (url: string | undefined): THREE.Texture | null => {
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();
  const [tex, setTex] = useState<THREE.Texture | null>(() => (url ? imgCache.get(url) ?? null : null));
  const [handle] = useState(() => (url && !imgCache.has(url) ? delayRender(`texture ${url}`) : null));
  useEffect(() => {
    if (!url) return;
    const hit = imgCache.get(url);
    if (hit) {
      setTex(hit);
      return;
    }
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        imgCache.set(url, t);
        setTex(t);
      },
      undefined,
      () => {
        if (handle !== null) continueRender(handle);
      },
    );
  }, [url, handle]);
  // after the texture is committed to the material: redraw, then release the render
  useEffect(() => {
    if (!tex) return;
    if (isRendering) advance(performance.now());
    else invalidate();
    if (handle !== null) continueRender(handle);
  }, [tex, handle, isRendering, advance, invalidate]);
  return tex;
};

/**
 * Video texture (Remotion-recommended approach, @remotion/media headless <Video> + CanvasTexture).
 * Render <VideoTextureSource> inside the ThreeCanvas and pass the returned texture to a screen.
 * Usage:
 *   const [tex, source] = useVideoScreen(staticFile("appflow.mp4"), 886, 1920);
 *   return <>{source}<Phone screen={tex} /></>;
 */
export const useVideoScreen = (src: string, w: number, h: number, opts: { trimBefore?: number; playbackRate?: number } = {}) => {
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();
  const [state] = useState(() => {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { ctx, tex };
  });
  const onVideoFrame = useCallback(
    (frame: CanvasImageSource) => {
      state.ctx.drawImage(frame, 0, 0, w, h);
      state.tex.needsUpdate = true;
      if (isRendering) advance(performance.now());
      else invalidate();
    },
    [state, w, h, isRendering, advance, invalidate],
  );
  const source = (
    <Video src={src} headless muted onVideoFrame={onVideoFrame} trimBefore={opts.trimBefore} playbackRate={opts.playbackRate} />
  );
  return [state.tex, source] as const;
};
