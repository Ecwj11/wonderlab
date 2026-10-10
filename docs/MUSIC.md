# Gentle background music

Buttons, navigation and game feedback also have independent [sound effects](SOUND_EFFECTS.md).

The child login and `/app` learning portal have an opt-in music control. Music begins only after the listener presses **Music**. The settings arrow selects a track and adjusts volume. The default is 18%; track and volume preferences are saved locally, while playback intent is never persisted across reloads.

Two original instrumental tracks were generated on 8 October 2026 using the local ComfyUI audio pipeline with ACE-Step `ace-step-v1.5-turbo`:

| Track            | Instruments / mood requested                     | Tempo  | Loop                     |
| ---------------- | ------------------------------------------------ | ------ | ------------------------ |
| Curiosity Garden | Felt piano, marimba, warm and curious            | 80 BPM | 72 seconds / 24 bars     |
| Little Explorer  | Ukulele, piano, wooden marimba, cosy exploration | 88 BPM | 65.455 seconds / 24 bars |

No online music library was used. The generator reports the model licence as Apache-2.0; this is recorded as generator metadata, not a separate legal assessment of generated output. Requests, seeds, model metadata, loop measurements, processing details and shipped file checksums are in `frontend/public/audio/PROVENANCE.json`.

## Assets

Shipped MP3 files are local, same-origin assets under `frontend/public/audio/`, stereo at 48 kHz / 160 kbps. Constant gain attenuation preserves the source dynamics and loop boundary. Measured integrated loudness is approximately −24.4 LUFS, with true peaks below −9.9 dBFS, before the default player volume is applied. ComfyUI is required only to regenerate assets, never during playback. Raw WAVs and job responses are kept in ignored `.local/music/` during development.

To recreate a track, submit its recorded `request` to the local audio service's `POST /audio/music`, poll `GET /jobs/{referenceNumber}`, then fetch `GET /audio/{referenceNumber}.wav`. Use a fresh reference number when changing a request. Encode the WAV with FFmpeg using `-af volume=<constantGainDb>dB -c:a libmp3lame -b:a 160k -ar 48000`, where gain comes from the recorded postprocessing metadata. Measure the result and update its checksum and provenance before replacing the public asset.

## Playback architecture

`MusicProvider` lives in the root layout and owns exactly one HTML audio element. `MusicTransport` manages explicit playback intent, allowed routes, visibility, track changes and asynchronous playback failures independently of React. The student header and child login render shared controls. Parent/admin routes pause playback and clear its intent; returning requires another click. Hidden tabs pause while preserving intent, so returning resumes only music the listener had enabled. Playback errors show a retryable message without disrupting lessons.

English, Chinese and bilingual labels follow the existing student language preference. Controls support keyboard navigation, labelled volume and track inputs, an Escape-dismissed settings panel and focus restoration. No additional animation or motion is introduced.

## Verification

- Unit tests cover explicit playback, low volume, track switching, hidden tabs, route restrictions, play/pause races, failed playback and untrusted stored settings.
- `scripts/e2e/music.spec.ts` checks real MP3 decoding and looping, no initial audio request, settings persistence without autoplay, retry after a missing asset, a single player across login/navigation, route pausing and mobile Chinese/bilingual controls.
