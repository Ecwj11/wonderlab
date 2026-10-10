# Subject Adventure background assets

Created 2026-10-06 with the built-in `image_gen.imagegen` tool in default built-in mode. These are opaque raster PNG backgrounds generated individually using Number Forest's background as a style reference. No CLI, API key, fallback model, vector substitutes or image manipulation was used. Each selected tool output was copied unchanged into the workspace; originals remain preserved at the paths below.

Style reference: `frontend/public/games/number-forest/background.png` (inspected before generation). Tool arguments for each asset: `transparent_background: false`, `referenced_image_paths: ["/Users/ericchan/work/text-to-game/frontend/public/games/number-forest/background.png"]`.

## Final assets

| File                                                    | Dimensions | Format         | Intended setting                                                                |
| ------------------------------------------------------- | ---------- | -------------- | ------------------------------------------------------------------------------- |
| `frontend/public/games/subject-adventure/science.png`   | 1672 × 941 | Opaque RGB PNG | Tropical school science garden, chillies and greenhouse                         |
| `frontend/public/games/subject-adventure/history.png`   | 1672 × 941 | Opaque RGB PNG | Melaka-inspired heritage river town; imagined game setting                      |
| `frontend/public/games/subject-adventure/geography.png` | 1672 × 941 | Opaque RGB PNG | Tropical coast, rainforest and distant mountains; imagined expedition landscape |
| `frontend/public/games/subject-adventure/general.png`   | 1672 × 941 | Opaque RGB PNG | Malaysian primary school courtyard and playground                               |

Each output was visually inspected individually. Dimensions and absence of alpha were verified with `sips`; SHA-256 checks confirmed that all four workspace copies exactly match the preserved originals. All retain the vibrant hand-painted platform-game style, thematic scenery and open lower gameplay space. No characters, baked gameplay platforms, UI, writing, labels, numbers, political maps or flags appear. The backgrounds are scenery only; separate platform sprites and colliders are expected from the game. Distant architectural steps and garden bed edging are background details, not collision surfaces. History is illustrative, not an exact historical reconstruction. Geography is a stylised exploration world, not a literal map.

## Exact final prompts and original outputs

### science.png

Original built-in output: `/Users/ericchan/.codex/generated_images/01a1113f-20da-7af2-b4ad-61a0002cff42/exec-d5973e82-0e7a-48ed-862e-4d7e04bd8b32.png`

Final copy: `/Users/ericchan/work/text-to-game/frontend/public/games/subject-adventure/science.png`

```text
Use case: stylized-concept.
Asset type: opaque wide landscape background plate for a polished 2D school adventure platform game for Malaysian primary school children.
Input image 1 is a STYLE REFERENCE ONLY: match its high-quality vibrant hand-painted 2D platform-game look, clear rounded silhouettes, lush layered atmosphere, soft brush textures, crisp painterly details, bright storybook light and coherent depth. Create a new distinct setting.
Composition: 16:9 wide landscape, side-on panorama with distant and middle-distance scenery. Show an environment background only. Keep the LOWER HALF visually quiet and uncluttered with softly painted distance, muted texture and unobstructed space behind gameplay; main thematic details clustered toward upper half and far sides. The game overlays separate grass platforms around world y=520, so NEVER bake in a solid foreground floor, ground strip, walkable platform, foreground stairs or a hard horizontal collision-looking ledge. Lower area may contain gently receding open courtyard/garden landscape or water, rendered as distant scenery without a foreground walking surface.
Constraints: cheerful safe sunlight, immersive children's game art, opaque image. No characters, people, mascots, collectible cubes, UI, interface, signs, writing, text, numerals, labels, flags, borders or watermarks. No photorealism, 3D render, stock illustration look or vector substitute.
Primary request: Malaysian school science garden. A sunny tropical school garden with bright red chilli peppers and leafy vegetable beds in the middle distance, a charming small glass greenhouse at the rear, low school building visible beyond the trees. Banana and hibiscus plants add familiar Malaysian school-garden character. Upper scene contains flourishing beds and greenhouse; lower half stays soft, airy and uncluttered for gameplay. Palette fresh leaf green, sky blue, terracotta and pops of chilli red. Believable plants, no laboratory equipment floating in air.
```

### history.png

Original built-in output: `/Users/ericchan/.codex/generated_images/01a1113f-20da-7af2-b4ad-61a0002cff42/exec-5b26b8b7-cbf0-4e1f-ad71-01607ba23461.png`

Final copy: `/Users/ericchan/work/text-to-game/frontend/public/games/subject-adventure/history.png`

```text
Use case: stylized-concept.
Asset type: opaque wide landscape background plate for a polished 2D school adventure platform game for Malaysian primary school children.
Input image 1 is a STYLE REFERENCE ONLY: match its high-quality vibrant hand-painted 2D platform-game look, clear rounded silhouettes, lush layered atmosphere, soft brush textures, crisp painterly details, bright storybook light and coherent depth. Create a new distinct setting.
Composition: 16:9 wide landscape, side-on panorama with distant and middle-distance scenery. Show an environment background only. Keep the LOWER HALF visually quiet and uncluttered with softly painted distance, muted texture and unobstructed space behind gameplay; main thematic details clustered toward upper half and far sides. The game overlays separate grass platforms around world y=520, so NEVER bake in a solid foreground floor, ground strip, walkable platform, foreground stairs or a hard horizontal collision-looking ledge. Lower area may contain gently receding open courtyard/garden landscape or water, rendered as distant scenery without a foreground walking surface.
Constraints: cheerful safe sunlight, immersive children's game art, opaque image. No characters, people, mascots, collectible cubes, UI, interface, signs, writing, text, numerals, labels, flags, borders or watermarks. No photorealism, 3D render, stock illustration look or vector substitute.
Primary request: Malaysian heritage town adventure background, warmly inspired by Melaka. Friendly old riverside shophouses with cream and pastel plaster, warm terracotta roofs, arched openings and wooden shutters, subtle decorative heritage roofline details, leafy riverside trees, a calm blue-green river leading toward the distance. A distant low pedestrian bridge may be high in the middle distance only. Celebrates Malaysian cultural heritage without claiming an exact historic reconstruction. Main architecture in upper and middle distance, lower half a quiet gently shimmering river with atmospheric reflections. Palette warm ochre, coral, teal water and soft tropical green. No texts, shop signs or flags.
```

### geography.png

Original built-in output: `/Users/ericchan/.codex/generated_images/01a1113f-20da-7af2-b4ad-61a0002cff42/exec-26e201c6-ced3-42bf-ae8d-8dfd35921923.png`

Final copy: `/Users/ericchan/work/text-to-game/frontend/public/games/subject-adventure/geography.png`

```text
Use case: stylized-concept.
Asset type: opaque wide landscape background plate for a polished 2D school adventure platform game for Malaysian primary school children.
Input image 1 is a STYLE REFERENCE ONLY: match its high-quality vibrant hand-painted 2D platform-game look, clear rounded silhouettes, lush layered atmosphere, soft brush textures, crisp painterly details, bright storybook light and coherent depth. Create a new distinct setting.
Composition: 16:9 wide landscape, side-on panorama with distant and middle-distance scenery. Show an environment background only. Keep the LOWER HALF visually quiet and uncluttered with softly painted distance, muted texture and unobstructed space behind gameplay; main thematic details clustered toward upper half and far sides. The game overlays separate grass platforms around world y=520, so NEVER bake in a solid foreground floor, ground strip, walkable platform, foreground stairs or a hard horizontal collision-looking ledge. Lower area may contain gently receding open courtyard/garden landscape or water, rendered as distant scenery without a foreground walking surface.
Constraints: cheerful safe sunlight, immersive children's game art, opaque image. No characters, people, mascots, collectible cubes, UI, interface, signs, writing, text, numerals, labels, flags, borders or watermarks. No photorealism, 3D render, stock illustration look or vector substitute.
Primary request: Malaysian tropical expedition adventure background. Expansive tropical coast with a turquoise sea channel in the lower half, palm-fringed islands and layered emerald rainforest in middle distance, far blue mountain silhouettes evoking exploration across peninsula and Borneo. Stylised imaginary game world, not a literal map. Upper half shows clouds, distant rainforest ridges and varied islands; lower half remains broad quiet turquoise sea, open and softly textured. Lush tropical planting, warm sandy coves at the distant sides only. No political borders, maps, labels or flags.
```

### general.png

Original built-in output: `/Users/ericchan/.codex/generated_images/01a1113f-20da-7af2-b4ad-61a0002cff42/exec-29e3262a-2813-436c-8cc7-fb88082c2020.png`

Final copy: `/Users/ericchan/work/text-to-game/frontend/public/games/subject-adventure/general.png`

```text
Use case: stylized-concept.
Asset type: opaque wide landscape background plate for a polished 2D school adventure platform game for Malaysian primary school children.
Input image 1 is a STYLE REFERENCE ONLY: match its high-quality vibrant hand-painted 2D platform-game look, clear rounded silhouettes, lush layered atmosphere, soft brush textures, crisp painterly details, bright storybook light and coherent depth. Create a new distinct setting.
Composition: 16:9 wide landscape, side-on panorama with distant and middle-distance scenery. Show an environment background only. Keep the LOWER HALF visually quiet and uncluttered with softly painted distance, muted texture and unobstructed space behind gameplay; main thematic details clustered toward upper half and far sides. The game overlays separate grass platforms around world y=520, so NEVER bake in a solid foreground floor, ground strip, walkable platform, foreground stairs or a hard horizontal collision-looking ledge. Lower area may contain gently receding open courtyard/garden landscape or water, rendered as distant scenery without a foreground walking surface.
Constraints: cheerful safe sunlight, immersive children's game art, opaque image. No characters, people, mascots, collectible cubes, UI, interface, signs, writing, text, numerals, labels, flags, borders or watermarks. No photorealism, 3D render, stock illustration look or vector substitute.
Primary request: friendly Malaysian primary school courtyard adventure background. Welcoming cream-and-peach school buildings with shaded open corridors and warm reddish roofs in upper middle distance, a modest colourful playground at the far side, lush shade trees, hibiscus and a neat school garden. Malaysian tropical school atmosphere, sunny blue sky and cheerful reassuring mood. School buildings and playground stay behind the gameplay area; lower half is an open courtyard receding softly into distance with low-contrast sunlit color, no marked lines, no foreground floor edge, no platforms. Palette warm cream, soft peach, leaf green, turquoise and playful small playground accents. No signs, school names or flags.
```
