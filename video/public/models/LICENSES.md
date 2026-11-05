# 3D model licenses (video/public/models)

All character models and animation clips used in the v2 / v3 videos are by **Quaternius**. The packs are released as
**CC0 1.0 (public domain)** on quaternius.com; one Poly Pizza mirror (SuitFemale) is listed as CC-BY 3.0, so it is credited.
Quaternius (https://quaternius.com, license: https://creativecommons.org/publicdomain/zero/1.0/).
CC0 requires no attribution; Quaternius is credited here as a courtesy. Materials are recolored per role in
`src/kit3d/gltf/cast.ts`; normals are re-smoothed at load time.

| File | Asset (pack) | Source URL | License |
|---|---|---|---|
| chars/SuitFemale.glb (Maya / Ava; v2 also Mom + dispatcher) | "Suit" by Quaternius, Animated Women Pack | https://poly.pizza/m/sOUciDsoVV (pack: https://quaternius.com/packs/animatedwomen.html, CC0) | **Poly Pizza lists this file as CC-BY 3.0**, so we treat it as CC-BY and credit it |
| chars/CasualFemale.glb (roommate, dispatcher) | "Animated Woman" casual, Animated Women Pack | https://poly.pizza/m/qJ2gsTUBHL | CC0 |
| chars/FormalFemale.glb (party friend, mom) | "Animated Woman" formal, Animated Women Pack | https://poly.pizza/m/nIItLV9nxS | CC0 |
| chars/CasualMale.glb (brother, driver) | "Casual Character", Animated Men Pack | https://poly.pizza/m/kZ3DmIoGip (pack: https://quaternius.com/packs/animatedmen.html) | CC0 |
| chars/SuitMale.glb (police officer) | "Business Man", Animated Men Pack | https://poly.pizza/m/JFrLIKqvCH | CC0 |
| chars/HoodieMale.glb (party guy, hooded follower) | "Hoodie Character", Animated Men Pack | https://poly.pizza/m/gKLBoRsyKe | CC0 |
| src/UAL1_Standard.glb (animation source) | Universal Animation Library [Standard] v3 | https://quaternius.itch.io/universal-animation-library | CC0 |
| anims/*.json | UAL clips retargeted to each rig by `scripts/bake_ual.mjs` (derived from the CC0 library) | (generated) | CC0 |

CC-BY credit: both end cards carry "3D characters: Quaternius (CC0 / CC-BY 3.0, via poly.pizza)"
(v2: src/v2/scenes4.tsx end card; v3: src/v3/scenes2d.tsx end card). Model: "Suit" by Quaternius, https://poly.pizza/m/sOUciDsoVV, CC-BY 3.0 https://creativecommons.org/licenses/by/3.0/.
Police cap, badge, headset, hood and ponytail are procedural meshes added in code (src/kit3d/gltf/GltfCharacter.tsx).
