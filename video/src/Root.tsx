import React from "react";
import { Composition } from "remotion";
import { Demo } from "./Demo";
import { AppLoop } from "./AppLoop";
import { FPS, TOTAL } from "./timeline";
import { ReelV2 } from "./v2/ReelV2";
import { S as V2S } from "./v2/cues";
const V2_TOTAL = V2S.total;
import { HybridV3 } from "./v3/HybridV3";
import { Kit3DShowcase, SHOWCASE_FRAMES } from "./kit3d/Showcase";
import { GltfLab } from "./kit3d/gltf/Lab";
import v2Timeline from "../scripts/v2_timeline.json";
import v3Timeline from "../scripts/v3_timeline.json";

// v2/v3 durations come from the approved VO timelines (runtime incl. gaps + end hold).
const V2_FRAMES = V2_TOTAL; // r9: trimmed end hold (see v2/cues S.total)
const V3_FRAMES = Math.ceil(v3Timeline.totalSec * 30);

export const Root: React.FC = () => (
  <>
    {/* v1 (archived render: presentation/videos/SafetySense-Demo-v1.mp4). Do not change. */}
    <Composition id="Demo" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ voiceover: true }} />
    <Composition id="DemoVertical" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ voiceover: true }} />
    <Composition id="AppLoop" component={AppLoop} durationInFrames={150} fps={FPS} width={1080} height={1080} />

    {/* v2 reel + v3 hybrid (3D kit: src/kit3d) */}
    <Composition id="ReelV2" component={ReelV2} durationInFrames={V2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="HybridV3" component={HybridV3} durationInFrames={V3_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="Kit3DShowcase" component={Kit3DShowcase} durationInFrames={SHOWCASE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="GltfLab" component={GltfLab} durationInFrames={300} fps={30} width={1920} height={1080} />
  </>
);
