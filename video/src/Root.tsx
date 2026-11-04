import React from "react";
import { Composition } from "remotion";
import { Demo } from "./Demo";
import { AppLoop } from "./AppLoop";
import { FPS, TOTAL } from "./timeline";

export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ voiceover: true }} />
    <Composition id="DemoVertical" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ voiceover: true }} />
    <Composition id="AppLoop" component={AppLoop} durationInFrames={150} fps={FPS} width={1080} height={1080} />
  </>
);
