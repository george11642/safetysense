import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Background, Phone } from "./components";

/** 5 s silent loop for slides: the check-in turning into an alert, sped up 2x. */
export const AppLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8, 142, 150], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o }}>
        <Phone w={450}>
          <OffthreadVideo src={staticFile("appflow.mp4")} startFrom={Math.round(5.03 * 30)} playbackRate={2} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
