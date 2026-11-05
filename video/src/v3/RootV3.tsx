// Standalone entry for rendering v3 on its own (independent of the other compositions' build state).
// Usage: npx remotion render src/v3/index.ts HybridV3 out.mp4 --gl=angle
import React from "react";
import { Composition } from "remotion";
import { HybridV3 } from "./HybridV3";
import { TOTAL_FRAMES } from "./timing";

export const RootV3: React.FC = () => (
  <Composition id="HybridV3" component={HybridV3} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
);
