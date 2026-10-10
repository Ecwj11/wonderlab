# 2D subject adventures

The user wants real 2D gameplay for other subjects like the number forest: a moving character, scenery, collection, learning missions and an exit. Malaysian primary pupils remain the audience. This extends the existing lesson/player flow rather than introducing generated game code.

## Design

Non-mathematics MATCHING scenes become semantic 2D exploration missions. Each existing pair supplies one collectible clue (`left`) and its correct meaning/action (`right`). Children walk and jump to find clues, choose a meaning from distinct alternatives, complete all missions, then physically reach the exit. Incorrect choices allow retries and do not unlock progress. The renderer submits the same complete `matchedIds` result that the backend already validates. Mathematics keeps its forest arithmetic game and supplementary memory board.

Four trusted themes: a school science garden, a Malaysian heritage town, a Malaysian geography expedition and a school kindness quest. Different backgrounds and landmarks distinguish them. Geography scenery is an imaginative game world rather than an accurate map; history scenery is stylised rather than a reconstruction. JSON supplies learning content; application code supplies geometry, physics, choices, controls and assets.

Palette: leaf green `#66a83e`, lagoon blue `#22a7c3`, warm wood `#94633c`, sunshine `#f8c84c`, violet `#8a60c8`, ink green `#194c43`. Nunito remains the friendly UI typeface. The stage dominates, with a compact mission bar above it and controls below the walking path. Desktop camera stays fixed; narrow screens use fixed sections. Walking stays enabled under reduced motion. Focus-scoped input releases on blur/pointer cancellation.

## Implementation plan

1. Test and add a semantic adventure adapter around existing forest physics: actual clue pickup, wrong/correct answers, all-mission gating, physical exit, maximum pairs and replay.
2. Build renderer/styles: keyboard/touch controls, grounded gait, start, pause/resume, hint, reset, fullscreen, accessible retry feedback, mission progress and victory. Keep mission tray outside the world.
3. Generate and bundle four backgrounds with the built-in image tool; preserve originals and document prompts. Reuse mascot walking and terrain art.
4. Pass subject through registry; route non-math MATCHING to adventure; widen the stage; update instructions, translations and provider prompts. Retain schema v1/backend completion validation.
5. Review, run TypeScript/lint/tests/builds, play real science/history/geography/general content, check steady camera/walking/mobile controls, and refresh the user's tab.
6. Regenerate non-math Malaysian samples through real Codex jobs so authored instructions match controls. Five were regenerated; the existing daily quota prevented GENERAL regeneration, whose original semantic pairs now use trusted adventure instructions. Preserve IDs/public visibility and publish only validated versions.

## Scope

No arbitrary React/HTML, new rendering library, active-provider changes or altered math progress. Renderer, artwork and integration have separate ownership. Tests exercise movement and mission gating, not just rendering.
