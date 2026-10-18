# Ear Warrior — "hear it / see it / play it back" Short (Remotion)

7 s, 1080×1920, 60 fps. Scenes of 2 s (the cuts are pushes — scenes slide off left/up and the next slides in, `src/Move.tsx`, 16 frames, no flash): **Hear it** (sound contour) → **Every note has a fret** (neck tour) → **Now play it back** (numbered answer markers) → **N/N** result (1 s).

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

## "Tabs guy" — 60 s pain sketch

An animated sketch (flat SVG characters, no live actors): a guitarist who plays perfectly from a tab freezes at a party when asked to play without one, and the quiet guy hears the tune once and plays it. Ends on the app's fretboard + `earwarrior.app`.

```bash
node render-pain.mjs                 # → public/ear-pain.wav + out/ear-pain.mp4 (1080×1920, 60 fps, 60 s, ~10 min)
node render-pain.mjs --audio-only    # soundtrack only
npm run dev                          # Studio → composition "Pain"
```

`pain/story.mjs` is the single timeline (scene times, the riff, Ode to Joy attempts with their wrong notes, the second voice). `pain/audio.mjs` and `src/pain/PainVideo.tsx` both read it, so every wrong note is heard when it is seen. Characters: `src/pain/Person.tsx` (two-bone arms that follow the guitar neck, mood-driven faces), sets: `Rooms.tsx`, props and captions: `Items.tsx`, fretboard picture-in-picture: `Inset.tsx`. On-screen text is English. The riff is original; Ode to Joy is public domain. Pitches were generated from the timeline, not listened to — **play the render before posting**.
