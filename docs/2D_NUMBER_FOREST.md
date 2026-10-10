# 2D Number Forest

The approved visual is the 2D Number Forest concept: a purple explorer, lush forest, counting blocks, a river bridge and a numbered treehouse exit. Implement it as a real platform game using the existing NUMBER_GAME JSON rounds. No generated code, new AI provider, database migration or lesson regeneration is required.

## Implementation

1. Generate local forest background, explorer, grassy platform and treehouse PNG assets from the approved reference. Asset task owns only public assets and its prompt record.
2. Build and test a deterministic trusted movement/collision engine. Each round supplies only operands and operation; platforms, physics, collectible positions and goals remain trusted application code.
3. Add a responsive game renderer with keyboard/touch movement, jumping, collection, arithmetic answer choice, bridge building, exit detection, pause, hints, fullscreen and replay. Renderer task owns its component, styles and curated translations.
4. Register it for NUMBER_GAME, give numerical games a wide stage with collapsible learning notes, and update Codex control descriptions. All existing lessons and scene identities remain valid.
5. Run workspace checks, production build, actual browser gameplay and mobile/bilingual checks; review the assembled change.

## Behavior

Children move and jump to collect blue/gold blocks. A subtraction mission collects the starting blue group and takes away the configured quantity. After collecting the required groups, the child chooses the arithmetic result to unlock the bridge. Wrong answers allow retries. Building the bridge does not complete a mission: the explorer must reach the treehouse exit. Falling returns to camp and preserves collected blocks. All rounds must be won before the scene submits its existing roundAnswers result; backend arithmetic checks and idempotent XP remain unchanged. Game coins and stars are local practice feedback.

Keyboard input belongs to the focused game; touch controls release on pointer cancellation/blur. Pause and hidden pages stop movement. Essential gameplay remains available with reduced motion enabled. New raster assets are bundled locally, with no third-party runtime asset URLs.

## Progress

- Design selected by the user; implementation authorized in the same request.
- Generated four original bundled PNG assets and implemented the reusable forest renderer and deterministic physics. Movement, collection, arithmetic, bridge and physical exit checks passed.
- Ruling: retain schema v1 and existing lesson versions because the change is a trusted presentation/interaction implementation for already validated NUMBER_GAME rounds. This avoids resetting learning progress.

## Controls and integration

Use left/right arrows or A/D to move, and Space/W/up arrow to jump. Keyboard input is scoped to the focused game. The on-screen arrows and Jump support held pointers, including simultaneous movement and jumping on touch screens. Hint, Pause/Resume, Restart level, Fullscreen and replay are provided in the game HUD. Each scene reuses its existing NUMBER_GAME operands; no lesson regeneration is needed to see the new presentation. Other interaction types keep their registered players.

The renderer loads bundled PNG assets described in FOREST_ASSETS.md. Platforms crop transparent source padding so artwork matches collision surfaces. The desktop camera shows the whole level and stays stationary. Smaller screens use stationary sections: the view changes only near an edge, with no animated pan. Hysteresis prevents small direction changes from flipping sections, and falls/replay recover the spawn view. Portrait devices use a narrower view without changing level coordinates. The counting tray sits above the world on every screen size, keeping the explorer visible even with twenty blocks. Learning notes collapse below the full-width stage.

The backend still checks complete unique roundAnswers against the stored version and arithmetic. Only after all scene requirements pass does it persist completion and award XP once. In-game stars and coins are practice feedback and are not submitted as XP.

## Browser regression tests

The optional forest browser suite uses real, already generated lessons, creates private verification copies and deletes those copies after testing. It never requests mock AI generation. Supply an addition-plus-matching lesson and a subtraction-only lesson:

```sh
E2E_FOREST_ADDITION_ID=<addition-lesson-id> E2E_FOREST_SUBTRACTION_ID=<subtraction-lesson-id> npx playwright test scripts/e2e/forest.spec.ts
```

Tests skip if their source IDs are not supplied. They run against the production server and require the documented development admin account.

## Walking and comfortable camera

The mascot has a four-frame transparent walking atlas derived from the original explorer. Actual grounded travel advances the gait, rather than a timer that keeps running at rest. Idle uses the planted-foot frame; airborne movement retains the jumping pose. Pause freezes the current frame, and blocked movement does not animate footsteps. Footsteps remain enabled with reduced motion because they are essential movement feedback; decorative transitions remain disabled and the camera stays stationary. Head position stays registered across the atlas without added bobbing.

Wide stages (at least 700 CSS pixels) show the entire 1600-unit level. Narrow stages hold a section stationary and cut to an overlapping section only when the explorer reaches the edge. Camera movement is never continuously tied to the mascot, and there are no camera shakes, pans or parallax layers.
