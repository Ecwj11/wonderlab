# Sound effects

Short, gentle Web Audio cues complement the existing background music. The root
`SoundProvider` owns one lazily created audio context across client navigation.
It creates no audio context until a trusted pointer or keyboard gesture occurs.

## Controls

The Sound button opens independent mute, volume and preview controls. It appears
in the learning, parent and admin headers, and alongside music on child login.
Student and parent controls support English, Chinese and bilingual UI copy.
Effects default to enabled at 30% with a bounded synthesis gain; music retains
its separate volume and explicit play behaviour. Settings persist for this
browser in `wonderlab.sound.v1`, and changes sync across tabs. No account or
family policy is changed by adjusting local sound settings.

## Cues and integration

- Ordinary buttons: a short soft tick.
- Links and navigation: a rising two-note cue.
- Expandable menus: a different two-note cue.
- Number Forest and subject adventures: takeoff, collected blocks, subtraction,
  bridge construction and reaching the exit, detected from state transitions.
- Adventure answers and memory matching: gentle correct/incorrect feedback.
- Quiz answers: feedback only after the backend checks the selected answer.
  Quiz submission plays a completion chime only after a successful response.
  Responses arriving after the quiz is closed cannot play feedback on another page.

Reusable scenes call `useSounds().play(cue)`. Content generators cannot inject
audio code or remote audio URLs. `data-sound="off"` suppresses delegated click
feedback where an explicit game cue takes its place. Movement buttons use this
attribute so holding or releasing them does not produce repeated click sounds.
No continuous footsteps are used.

`SoundTransport` limits concurrent voices and repeated identical cues. Each tone
has a short attack/release envelope. Muting, changing volume, hiding the page
and disposing the provider stop active voices. Pending browser resume operations
are invalidated by these changes; stale cues are discarded. Unsupported or
blocked audio leaves learning usable. Hidden pages cannot play new cues.

## Verification

`frontend/tests/sounds.test.ts` verifies gesture gating, volume, mute, cleanup,
browser-resume races, throttling and game-state transitions.
`scripts/e2e/sounds.spec.ts` uses native Web Audio with an analyser to verify
rendered samples, distinct button/menu/navigation cues, persistent mute and
volume, and a mobile control panel. Run with `E2E_BASE_URL=http://localhost:7777`.
The number-block end-to-end tests additionally verify audio during gameplay
when `E2E_SOUNDS=1 E2E_MATH_BLOCKS=1` is set; they use temporary student accounts.
