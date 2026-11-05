// Neutral turntable studio (character lineups, prop close-ups, title cards in 3D).
import React from "react";
import * as THREE from "three";
import { gradientTex } from "../materials";
import { Bokeh } from "../fx";
import { P } from "../palette";

export const Studio: React.FC<{ top?: string; bottom?: string; floor?: string; keyColor?: string; rimColor?: string; bokeh?: boolean }> = ({
  top = "#241f44", bottom = "#5a3260", floor = "#2a2444", keyColor = "#fff1e0", rimColor = P.accent, bokeh = true,
}) => (
  <group>
    {/* cyclorama backdrop */}
    <mesh position={[0, 6, -8]}>
      <planeGeometry args={[60, 16]} />
      <meshBasicMaterial map={gradientTex([[0, top], [0.7, bottom], [1, bottom]])} toneMapped={false} fog={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 30]} />
      <meshStandardMaterial color={floor} roughness={0.85} />
    </mesh>
    <hemisphereLight args={["#9a9ae0", "#3a2440", 0.9]} />
    <directionalLight
      position={[3, 6, 6]} color={keyColor} intensity={2.2} castShadow
      shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004} shadow-normalBias={0.02}
      shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={6} shadow-camera-bottom={-2}
    />
    <directionalLight position={[-5, 3, 4]} color="#9ec9ff" intensity={0.7} />
    <directionalLight position={[0, 4, -6]} color={rimColor} intensity={2.4} />
    {bokeh && <Bokeh center={[0, 3, -6]} spread={[16, 5, 1]} count={14} size={[0.8, 1.8]} opacity={0.25} />}
  </group>
);
void THREE;
