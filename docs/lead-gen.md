# Ear Warrior — lead-gen copy (Instagram + YouTube)

Drafted 2026-10-16. **Not published, nothing here is live.** Goal: waitlist leads, from Instagram and YouTube only (TikTok is out).
Funnel today (Instagram, 30 d to 2026-10-11): 4 360 views → 44 profile visits (1 %) → 5 link taps (11 %) → 2 leads. Each idea below targets one step.

Copy follows `docs/voice.md`: direct, calm, sentence case, no exclamation marks, typographic `’`. No invented numbers; every `[bracket]` is a decision for the author.

**Decisions needed before anything goes live**

| # | Decision | Why it matters |
|---|---|---|
| D1 | What exactly is the "beta" — platform (Android / iOS), how many testers, when | Google Play’s closed test needs a developer account (not created as of 2026-10-11); the landing says "iOS and Android". Don’t promise a date or a platform the build can’t meet |
| D2 | What testers get — keep "lifetime access for the first 100"? | The landing already promises it (`landing/index.html:405`); a beta offer must not contradict it |
| D3 | Voice for the long video: your own voice, or on-screen text only | Changes the production plan, not the script |

UTM links (the landing turns these into `source:campaign:content`, `landing/index.html:643`):

- Instagram bio: `https://earwarrior.app/?utm_source=instagram&utm_campaign=bio&utm_content=profile`
- YouTube channel link: `…?utm_source=youtube&utm_campaign=channel&utm_content=profile`
- YouTube long video: `…?utm_source=youtube&utm_campaign=long01&utm_content=desc`

---

## 1. Instagram

**Name field** (searchable): `Ear Warrior · Guitar by ear`

**Bio** (pick one; one action, one link):

- A: `Play guitar by ear. No tabs.` / `Free early access for guitarists ↓`
- B: `Learn songs by ear on guitar.` / `Hear it once, play it back. Early access ↓`

**Pin** the three reels that drew guitarists: #20 (1 518 views), #24 (1 367 views, 10 saves), #26 (the wrong-note one).

**Highlight "Beta"** — three story frames, each a plain card:

1. `Hear a melody once.` / `Play it back on a fretboard.`
2. `The app shows which notes landed.` / `No tabs. No chords. Just your ear.`
3. `[Early access for guitarists]` + link sticker (stickers are clickable in stories, not in reels).

**In-video label** (small, whole video, not an end card; replaces nothing in the hook): `Early access for guitarists → bio`

**Caption line** (last line of every reel caption): `Early access for guitarists → link in profile.`

(The "Comment BETA, I’ll DM the link" ask and its DM auto-reply were dropped 2026-10-18: the ask is the profile link only.)

**Partner message** to small guitar teachers / creators (1–10 K followers), sent as a DM:

> Hi [name] — I’m a guitarist building an app that trains playing by ear: it plays a melody once, you play it back on a fretboard, it shows which notes landed.
> I’m looking for guitarists for early access. If it fits your students, I’d give you [what you get — D2] and a link to share. No obligation — happy to send a build first.

---

## 2. YouTube

Shorts links (description *and* comments) are not clickable since August 2023, so Shorts cannot carry the offer. What is clickable: the channel profile link, and long-form descriptions and comments.

**Channel link** (profile → Links): `earwarrior.app` with the YouTube UTM above. Title it `Early access for guitarists`.

**Channel description** (first two lines show in search):

> Learn to play guitar by ear — no tabs. Hear a melody once, play it back.
> Early access for guitarists: link below.

**In Shorts**: no link, but the brand URL in the first line of the description (plain text, someone may type it) and the same small label as Instagram, text only: `earwarrior.app`.

---

## 3. Landing — proposed copy change (not applied)

Today: button `Claim lifetime access`, fine print `One email when we launch… Coming soon on iOS and Android.` Proposal, pending D1/D2 (keep the lifetime perk; only name the reason to sign up now):

- Button: `Join early access`
- Line above the form: `[Early access for guitarists — we’re opening the first [N] spots on [platform].]`
- Fine print: unchanged

---

## 4. Long video — "Play guitar by ear" (script, not rendered)

Search-intent video, so it keeps earning after the feed forgets it; the link is clickable in its description and pinned comment.

**Working title** (pick one): `How to play guitar by ear (the 3-step loop, no tabs)` · `Learned from tabs? Train this next` · `Play any melody by ear: a 6-minute method`
**Thumbnail:** fretboard with one lit note and three words — `PLAY BY EAR`
**Length:** ≈ 6 min · **Style:** faceless — animated neck (the app’s fretboard look), captions, music bed; voice per D3
**Audio:** all melodies on the recorded acoustic guitar; Ode to Joy is public domain
**Rules:** no statistic, no "most guitarists can’t", no promise of a result in X weeks (`docs/voice.md` §8); a miss is "not quite", never "wrong"

| Time | Picture | Voice-over / on-screen text |
|---|---|---|
| 0:00–0:20 | Neck, no text. The first phrase of Ode to Joy plays once on the B string (frets 5 5 6 8 8 6 5 3). Then caption: `Play it back. No tabs.` | "Listen to this once. Now — without a tab — could you play it back? If you learned from tabs, you’ve probably never trained that. This video is the training." |
| 0:20–1:00 | A tab fills with numbers, then every number turns into `?`; cut to a plain neck | "A tab tells your fingers where to go. Your ear never has to decide anything. And when someone says ‘just play along’, there’s no tab for it. The fix is a skill, and a skill can be practised." |
| 1:00–1:40 | Four steps appear as a loop: hear → guess → check → fix | "The whole method is a loop. Hear a short melody. Guess it. Check it. Fix it. Everything else is making each step smaller." |
| 1:40–2:40 | Chord loop plays; a home note glows on the B string (fret 1 = C) | **Step 1 — find home.** "Play a few chords or a backing track. Hum the note that feels like the end of the tune. Slide along one string until your voice and the guitar match. That’s your home note — every other note is measured from it." |
| 2:40–4:10 | The 8 notes appear as steps on one string. Contour first: arrows up / same / down; then each note named by fret. A deliberate wrong guess is shown in the warm "not quite" colour, then corrected | **Step 2 — shrink the melody.** "Never try eight notes at once. Take two to four. First just the shape: same, up, down. Then the size of each step. Frets 5, 5, 6, 8 — that’s the start of Ode to Joy." |
| 4:10–5:00 | Recorded phrase and the viewer’s play-back side by side; matched notes light up, a missed one is dashed | **Step 3 — check, then fix.** "Play it back against the recording. A miss isn’t a failure, it’s information. If the same note misses twice, the step is bigger or smaller than you think — hum it again, then try the next fret." |
| 5:00–5:40 | A simple 10-minute session card: 3 melodies, add one note once you nail it twice | **A routine.** "Ten minutes a day. Start with three notes. When you get a melody twice in a row, add one more note. Use tunes you already know — your ear has a head start." |
| 5:40–6:20 | App screen recording: melody plays once, fretboard input, "3 of 5 notes matched" (capture from the real app; never a mock number) | "I built Ear Warrior for exactly this loop: it plays a melody once, you play it back on an on-screen fretboard, and it shows which notes landed. [Early access for guitarists — link in the description (D1, D2)]. Tonight, try it without the app: pick a tune you know and find the first four notes." |

**Description** (draft)

> Learn to play guitar by ear — the 3-step loop: find home, shrink the melody, check and fix.
> 0:00 Listen once · 0:20 Why tabs leave a gap · 1:00 The loop · 1:40 Step 1: find home · 2:40 Step 2: shrink the melody · 4:10 Step 3: check and fix · 5:00 A 10-minute routine · 5:40 Early access
> Early access for guitarists: [UTM long01 link]
> Melody: Ode to Joy (Beethoven, public domain).

**Pinned comment:** the same link and one line: `Early access for guitarists:` + link.

**Open points**

- The home-note method (hum the note that feels like the end) and "same / up / down first" are standard teaching practice, but this script has not been checked against a teacher — read steps 1–2 once and change anything you wouldn’t teach.
- The app clip at 5:40 requires a real capture from the MVP build (fretboard input); if that isn’t ready, use the animated fretboard and drop the "3 of 5" line.
