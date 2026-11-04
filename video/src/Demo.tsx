import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { Background, Captions, SceneFade } from "./components";
import { AppDemo, Close, Diff, Hook, How, Meet, Privacy, Problem, Share, Triggers } from "./scenes";
import { FPS, SCENES, SceneId, TOTAL, VOS, XFADE, buildCaptions, sceneStart } from "./timeline";

const COMPONENTS: Record<SceneId, React.FC> = {
  hook: Hook, problem: Problem, meet: Meet, how: How, triggers: Triggers, app: AppDemo,
  share: Share, privacy: Privacy, diff: Diff, close: Close,
};

const cues = buildCaptions();

export const Demo: React.FC<{ voiceover: boolean }> = ({ voiceover }) => {
  const appStart = sceneStart("app");
  // Ladder step changes inside the app recording (seconds from the app scene start).
  const ticks = [5.03, 10.03, 19.0, 25.53];
  return (
    <AbsoluteFill>
      <Background />
      {SCENES.map((s, i) => {
        const from = sceneStart(s.id);
        const C = COMPONENTS[s.id];
        const last = i === SCENES.length - 1;
        return (
          <Sequence key={s.id} from={from} durationInFrames={s.dur + (last ? 0 : XFADE)} name={s.id}>
            <SceneFade dur={s.dur} out={XFADE} first={i === 0} last={last}>
              <C />
            </SceneFade>
          </Sequence>
        );
      })}
      <Captions cues={cues} />

      {/* Sound: a soft generated pad, whooshes on scene changes, chimes on the brand moments. */}
      <Audio src={staticFile("sfx/pad.wav")} volume={(f) => interpolate(f, [0, TOTAL - 60, TOTAL], [0.55, 0.55, 0], { extrapolateRight: "clamp" })} />
      {SCENES.slice(1).map((s) => (
        <Sequence key={"w" + s.id} from={sceneStart(s.id) - 10} durationInFrames={30}>
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
        </Sequence>
      ))}
      <Sequence from={sceneStart("meet") + 4} durationInFrames={60}><Audio src={staticFile("sfx/chime.wav")} volume={0.6} /></Sequence>
      <Sequence from={sceneStart("close") + 2} durationInFrames={60}><Audio src={staticFile("sfx/chime.wav")} volume={0.6} /></Sequence>
      <Sequence from={sceneStart("hook") + 86} durationInFrames={40}><Audio src={staticFile("sfx/thud.wav")} volume={0.7} /></Sequence>
      <Sequence from={appStart + Math.round(4.8 * FPS)} durationInFrames={40}><Audio src={staticFile("sfx/thud.wav")} volume={0.8} /></Sequence>
      {ticks.map((t) => (
        <Sequence key={"t" + t} from={appStart + Math.round(t * FPS)} durationInFrames={20}><Audio src={staticFile("sfx/tick.wav")} volume={0.45} /></Sequence>
      ))}
      {voiceover && VOS.map((v) => (
        <Sequence key={v.key} from={sceneStart(v.scene) + Math.round(v.at * FPS)} durationInFrames={Math.ceil(v.dur * FPS) + 6}>
          <Audio src={staticFile(`vo/${v.key}.wav`)} volume={1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
