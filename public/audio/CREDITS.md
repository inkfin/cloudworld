# Audio sources

## Footsteps

Kenney, **Impact Sounds**, CC0 1.0.
Source: https://kenney.nl/assets/impact-sounds
License: https://creativecommons.org/publicdomain/zero/1.0/

- `stone-0.wav` … `stone-3.wav`: `footstep_concrete_000.ogg` … `003.ogg`.
- `wood-0.wav` … `wood-3.wav`: `footstep_wood_000.ogg` … `003.ogg`.
- `grass-0.wav` … `grass-3.wav`: `footstep_grass_000.ogg` … `003.ogg`.
- `sand-0.wav` … `sand-3.wav`: filtered `footstep_snow_000.ogg` … `003.ogg`, repurposed as soft granular sand foley. This is sound design, not a beach footstep field recording.

Changes: mono conversion, gentle high/low-pass EQ, peak balancing, short edge fades, decoded to 44.1 kHz 16-bit PCM WAV. WAV avoids an additional lossy encoding generation; it does not restore information absent from the source Ogg files.

## Sea

Jasinski, **Alkai Beach**, CC0 1.0. Excerpts shared by qubodup as **Beach Ocean Waves**.
Source: https://opengameart.org/content/beach-ocean-waves
Original recording: https://freesound.org/people/jasinski/sounds/18363/
License: https://creativecommons.org/publicdomain/zero/1.0/

- `sea-0.wav`: `wave_01_cc0-18363__jasinski__alkaibeach.flac`.
- `sea-1.wav`: `wave_02_cc0-18363__jasinski__alkaibeach.flac`.

Changes: mild high/low-pass EQ, short edge fades, lossless PCM WAV storage. Stereo and original 44.1 kHz sample rate retained. The application schedules individual surges with different intervals, levels and filtering for each period.

Wind, piano, room responses and the character's vowel call are synthesized by the project. No microphone or remote audio service is used. All runtime assets are served from this repository.
