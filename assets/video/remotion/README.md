# Ear Warrior — "hear it / see it / play it back" Short (Remotion)

7 s, 1080×1920, 60 fps. Scenes of 2 s: **Hear it** (sound contour) → **Every note has a fret** (neck tour) → **Now play it back** (numbered answer markers) → **N/N** result (1 s).

```bash
npm run render -- tunes/turkish-march.json            # → out/turkish-march.mp4
npm run render -- tunes/a.json tunes/b.json           # several in one go
npm run render:all                                    # every tunes/*.json
npm run render -- tunes/x.json --audio-only           # soundtrack only → public/x.wav
npm run dev                                           # Remotion Studio (opens the Turkish March)
npm run typecheck
```

A tune is one JSON file (see the header of `tune.mjs` for the format): `id`, `bpm`, `key`, `listen` (≤ 2 s), optional `tour` (≤ 2 s), optional `chord`, optional `copy` overrides
(hook lines, chip, result line, tagline — `*word*` = accent). Notes are `NAME:BEATS`, optionally pinned to a fret with `@G4`; otherwise the fretting is chosen automatically.
Too long a phrase fails with the number of seconds it needs — raise `bpm` or shorten it.

Sound = the recorded acoustic guitar in `../synth.mjs` + a kick/shaker pulse on `bpm`. Tunes must be public domain; the melodies in `tunes/` were written from memory — **play the render and compare with a recording before posting.**
