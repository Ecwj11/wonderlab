# Number Forest artwork

Generated on 2026-10-06 using the built-in `image_gen.imagegen` tool with the imagegen skill. No CLI fallback or API key was used. Each asset was generated independently from the approved Number Forest concept as a style reference, with `referenced_image_paths`. The original reference and original generated files were preserved.

## Runtime assets

All final PNGs are saved in `frontend/public/games/number-forest/`.

| File           | Dimensions  | Format            | Purpose                                   |
| -------------- | ----------- | ----------------- | ----------------------------------------- |
| background.png | 1672 × 941  | RGB, opaque       | Scenic plate; no baked gameplay or UI     |
| explorer.png   | 1272 × 1236 | RGBA, transparent | Right-facing purple explorer              |
| platform.png   | 2172 × 724  | RGBA, transparent | Grass and rock terrain strip              |
| treehouse.png  | 1024 × 1536 | RGBA, transparent | Closed door; runtime adds lock and number |

The background is deliberately separate from walkable platforms, the bridge, collectibles, arithmetic, interface, and door. Runtime code supplies those trusted gameplay and UI layers.

## Transparency and placement

Alpha channels were inspected without altering the pixels. The three sprite assets contain genuine alpha-zero background pixels. The treehouse PNG retains colored RGB data beneath alpha zero; some image viewers show those hidden colors, while a browser correctly composites the alpha.

Visible bounds at alpha > 16, in intrinsic pixel coordinates (right and bottom exclusive):

- Explorer: `(130, 71)–(1157, 1184)`. Its visible art occupies roughly 81% of the canvas width and 90% of its height.
- Platform: `(17, 205)–(2153, 585)`. The grassy silhouette begins about 28% down the canvas. Use runtime cropping/positioning so collision geometry aligns with the grass; the PNG itself was preserved.
- Treehouse: `(11, 0)–(1016, 1494)`. The door stays clear for a runtime lock/number overlay.

The terrain strip is stretchable for the initial scene but is not guaranteed to be mathematically seamless when repeated. Align its visible grass surface with platform collision geometry.

## Reference

Approved concept image:

`/Users/ericchan/.codex/generated_images/01a10ed4-3d07-7590-9970-efed810ab275/exec-b33b66d4-b64b-45ee-8003-2eea756db93e.png`

## Final prompts

### background.png

`transparent_background: false`

```text
Use case: illustration-story. Asset type: landscape 16:9 background plate for a production 2D side-scrolling children's platform game Number Forest. Input image 1 is a STYLE AND WORLD REFERENCE only: derive a NEW standalone background layer from its illustrated forest setting. Lush hand-painted green forest canopy framing the edges, soft blue sky and fluffy clouds, distant fairy tale castle with tiny warm towers, layered evergreen trees, distant pale stone cliffs and turquoise waterfalls cascading into a stream. Charming flat 2D illustrated cartoon painting with bold gentle outlines and organic brush texture, vibrant cheerful daylight. Scenic view straight-on for a 2D platformer, NO perspective render or 3D game screenshot. Composition: lower half largely open distant misty water/soft scenery so separate game platforms can overlay cleanly; canopy frames upper corners without obscuring play area. Constraints: remove all text, signs, UI, logos, numbers, equation boards, characters, cubes, collectibles, foreground walkable platforms, bridge, doors and treehouse from the reference. This is ONLY an atmospheric scenic background plate. No UI or baked gameplay objects.
```

Original generated file: `/Users/ericchan/.codex/generated_images/01a11054-8381-7062-b5ff-e2c82638db73/exec-f2b9a9ba-ccd7-46a5-8710-26cbe3a4696f.png`

### explorer.png

`transparent_background: true`

```text
Use case: illustration-story. Asset type: standalone transparent 2D game character sprite. Input image 1 is a STYLE AND CHARACTER reference only. Create the charming cute purple explorer creature from the reference as one isolated full-body sprite, wearing brown explorer hat with turquoise goggles, tan explorer clothing and brown boots, green backpack, purple tail, enormous expressive black-and-white eyes and joyful smile. Cheerful airborne running/jumping pose facing RIGHT, one bent leg and one extended leg, arms naturally moving, entire head/hat/body/feet/tail visible. Lush hand-painted 2D cartoon illustration with bold gentle outlines matching the reference, flat side-view game sprite, not 3D. Center the character and let it occupy approximately 80% of the canvas height, with moderate empty alpha margin, no cropping. Genuine transparent background, clean alpha outline. No ground, no contact shadow, no floor, no scene, no UI, text, numbers, border or additional character.
```

Original generated file: `/Users/ericchan/.codex/generated_images/01a11054-8381-7062-b5ff-e2c82638db73/exec-dcaf1661-e66a-4352-8438-61cc2643abe4.png`

### platform.png

`transparent_background: true`

```text
Use case: illustration-story. Asset type: transparent 2D platformer terrain sprite. Input image 1 is a STYLE AND MATERIAL reference only. Create ONE wide horizontal grass-covered rock ledge seen straight-on in side view, approximately 4:1 width-to-height composition. Bright lime-green softly rounded grassy top edge, small lush painted grass tufts, layered irregular warm gray and golden brown rock/earth face, a few downward leafy vines. Charming hand-painted cartoon with bold gentle outlines exactly in the visual family of the reference forest. Flat 2D side view with a level horizontal top suitable for game collision, no perspective/isometric/3D. Designed as a stretchable/tile-friendly ground ledge: entire grass-and-rock strip fully visible with modest transparent padding, no detached islands. True transparent alpha background. No scenery, no sky, no props, flowers, coins, cubes, signs, characters, shadow floor, text, UI or water.
```

Original generated file: `/Users/ericchan/.codex/generated_images/01a11054-8381-7062-b5ff-e2c82638db73/exec-e7b3ea7a-f2aa-4c6f-9185-d03637fa78bc.png`

### treehouse.png

`transparent_background: true`

```text
Use case: illustration-story. Asset type: transparent 2D game treehouse door landmark. Input image 1 is a STYLE AND TREEHOUSE reference only. Create a tall cozy treehouse doorway embedded in a large warm brown tree trunk, closed arched wooden plank door with dark iron hinges, small gold handle but NO padlock and NO number, painted leafy vines and a few tiny flowers around the trunk, warm amber small hanging lanterns. Lush hand-painted flat 2D children's game illustration, bold gentle outlines and organic brush texture matching reference. Front-facing straight-on view; isolated door and tall tree trunk, with a little canopy leaf silhouette near its top, no ground platform, minimal roots integrated at base. Door fully visible and clear so code can overlay a central lock and number. Entire landmark centered, large in portrait canvas with modest empty transparent padding. Genuine transparent background, no scene, sky, UI, signs, labels, text, digits, banners, characters, cubes or bridge. Not a 3D render.
```

Original generated file: `/Users/ericchan/.codex/generated_images/01a11054-8381-7062-b5ff-e2c82638db73/exec-c6e25f1f-3343-4858-bfa0-23646ee9b58e.png`

## Validation

Each saved asset was visually inspected with `view_image`. Dimensions and alpha presence were checked with `sips`; alpha-zero pixels and visible bounds were checked with a read-only Pillow inspection. No post-generation image editing was performed.

## explorer-walk.png

Generated with the built-in image tool on 2026-10-06 using explorer.png as the edit reference. The original explorer and original generated output were preserved. Original output: `/Users/ericchan/.codex/generated_images/01a10ed4-3d07-7590-9970-efed810ab275/exec-5cc91090-66cc-465e-b62a-2aac4d41a17e.png`. Runtime PNG: 1254×1254 RGBA, four 627×627 cells in a 2×2 grid. Alpha was inspected without editing pixels. All frames share x bounds44..599 and y origin24; the common crop is555×599. Runtime SVG viewBoxes select the registered cells.

Prompt: preserve the same purple mascot, hat/cyan goggles, cream shirt/orange scarf, green backpack, brown shorts/boots and painted 2D style; generate exactly four uniformly registered transparent quadrants showing alternating strides and passing feet. Keep head, hat and torso fixed in position and size; use the same ground baseline, modest arm swing, no scenery, floor, shadows, text, blur or extra limbs.
