# Feature Specification: Video Publishing (YouTube + Instagram)

**Feature Branch**: `007-video-publishing` (not created — work lands on `master`)

**Created**: 2026-10-16

**Status**: Draft — implemented and tested with fakes; first live runs started 2026-10-16 (see Verification status)

**Input**: The author renders short challenge videos (`assets/video/challenge/out/`) and today uploads each one by hand to
three apps. They want to hand a finished file to Claude and have it published to YouTube and Instagram through the official
APIs, with a title and caption written in the project's voice, and the result recorded so it can be tied to the analytics
(`specs/006-social-analytics`) and to `docs/experiments.md`.

## Clarifications

### Session 2026-10-16

- Q: Which platforms? → A: **YouTube (Shorts)** and **Instagram (Reels)** through their official APIs. TikTok is out of scope (its posting API needs an app audit; until then it is private-only) and stays a manual / browser-assisted job.
- Q: Does Claude publish on its own? → A: **No.** Publishing to a public audience always needs the owner's explicit yes for that specific video in chat. The tool itself is a dry run by default and publishes only with an explicit `--confirm`.
- Q: Where does it run? → A: **Locally**, as a command in `server/` (`npm run publish`). Write credentials are separate from the read-only analytics credentials and are never sent to the hosted backend.
- Q: How does the file reach Instagram? → A: **Verified live (2026-10-16): the Instagram API with Instagram Login does not accept a resumable upload** — every variant answers "The parameter video_url is required". Meta has to download the video from a public https address, so the file is parked in a **Vercel Blob** store (random-suffix address) for the minutes it takes Meta to process it and deleted immediately afterwards.
- Q: YouTube visibility? → A: Videos uploaded through the API by a Google Cloud project that has not passed Google's audit are **forced to private**. The tool therefore uploads as private and the owner presses Publish in Studio (or the project is audited later).
- Q: Where do the title and caption come from? → A: The owner states the intent in chat; Claude writes the text following `docs/voice.md` and the experiment hook, shows it, and only then publishes. The tool only validates and assembles (hashtags, link, limits).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview what would be published (Priority: P1)

As the author, I want to see exactly what would go out — file checks, title, caption, tags, link, where it would be posted — before anything is sent.

**Why this priority**: it is the safety net; every other story builds on it.
**Independent Test**: run the command with a rendered video and no confirmation → it prints the plan and changes nothing anywhere.

**Acceptance Scenarios**:

1. **Given** a valid rendered video, **When** I run it without confirmation, **Then** it lists per platform the final title/caption, tags, the tracking link, the file's checks and whether the file was already published there, and sends nothing.
2. **Given** a file that cannot work on a platform (not vertical, wrong codec, too long for a Short, missing audio track encoding), **When** I run it, **Then** the problem is reported in plain words and that platform is not offered.
3. **Given** a title/caption/tag set over a platform's limits, **When** I run it, **Then** it is refused with the limit and the current length.

---

### User Story 2 - Publish to Instagram (Priority: P1)

As the author, I want to publish a Reel to my Instagram Business account from the file on disk.

**Independent Test**: publish a test video with the "stage only" option → the platform accepts and processes the upload and reports it ready, and nothing is public; then a confirmed run publishes it and returns its link.

**Acceptance Scenarios**:

1. **Given** a valid video and the publish credential, **When** I confirm, **Then** the Reel is uploaded, processed, published, and its permalink is shown and recorded.
2. **Given** I ask for "stage only", **When** I confirm, **Then** the file is uploaded and processed but not published.
3. **Given** the platform reports a processing error, **When** it happens, **Then** nothing is published and the platform's reason is shown.

---

### User Story 3 - Upload to YouTube (Priority: P1)

As the author, I want to upload a Short to my channel with title, description and tags.

**Independent Test**: confirm an upload → a private video appears in Studio with the right metadata and its link is shown.

**Acceptance Scenarios**:

1. **Given** a valid video and the upload credential, **When** I confirm, **Then** the video is uploaded as **private**, marked as not made for kids, with the title, description (including `#Shorts`), tags and tracking link, and the watch and Studio links are shown and recorded.
2. **Given** the daily API quota is exhausted, **When** an upload is attempted, **Then** the platform's message is shown and nothing is recorded as published.

---

### User Story 4 - Never publish the same thing twice, and keep a record (Priority: P2)

As the author, I want a record of what went where, and a guard against accidental duplicates.

**Independent Test**: publish a video, run the command again for the same file and platform → it refuses unless forced; the record lists both entries.

**Acceptance Scenarios**:

1. **Given** a file already published to a platform, **When** I run it again for that platform, **Then** it is skipped with a pointer to the earlier post, unless I force it.
2. **Given** a successful publication, **When** it finishes, **Then** a record (file, experiment number, platform, post id, link, time, visibility, title) is added to a tracked file without any secret.
3. **Given** the record, **When** analytics later lists posts, **Then** the post id can be joined to the experiment number (feeds task T028 of spec 006).

---

### User Story 5 - Keep write access separate and safe (Priority: P2)

As the author, I want the ability to post to stay on my machine and apart from the read-only analytics access.

**Acceptance Scenarios**:

1. **Given** the hosted analytics backend, **When** its configuration is inspected, **Then** it holds no upload or publish credential.
2. **Given** any run, **When** output, logs or errors are produced, **Then** they contain no token or secret.
3. **Given** a missing credential, **When** a platform is requested, **Then** the tool names the missing item and how to obtain it, and the other platform still works.

### Edge Cases

- The same video is published to both platforms; one succeeds and one fails → each is recorded on its own, the exit status reports the failure.
- Instagram processing takes longer than usual → the tool waits up to a bound, then stops with the container id so the owner can retry the publish step.
- The experiment number cannot be read from the file name → the tracking link omits the campaign and the record has no number.
- Caption contains characters Instagram rejects or exceeds 2 200 characters → refused before upload.
- A hashtag list contains duplicates, `#` prefixes or spaces → normalised once.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tool MUST run as a dry run by default and MUST NOT contact any publishing endpoint without an explicit confirmation flag.
- **FR-002**: Before any upload it MUST inspect the file and check it against each platform's constraints (vertical orientation, H.264 video, AAC audio, duration limits for Shorts/Reels, size) and report failures per platform.
- **FR-003**: It MUST assemble platform-specific text: YouTube title (≤ 100) and description (≤ 5 000, including `#Shorts` and the tracking link), Instagram caption (≤ 2 200, ≤ 30 hashtags, no link), normalised tags.
- **FR-004**: The tracking link MUST carry `utm_source=<platform>`, `utm_campaign=ear<NN>` (two-digit experiment number from the file name when present) and `utm_content=desc`, matching the landing page's source tags.
- **FR-005**: YouTube uploads MUST be sent as private, not made for kids; Instagram uploads MUST be Reels, shared to the feed.
- **FR-006**: Instagram publishing MUST wait for the platform to finish processing before publishing and MUST NOT publish if processing failed; a "stage only" option MUST upload and process without publishing.
- **FR-007**: Every successful publication MUST be appended to a tracked record without secrets; a file already recorded for a platform MUST be refused unless forced.
- **FR-008**: Credentials MUST come from environment variables kept separate from the analytics ones, MUST NOT be sent to the hosted backend, and MUST NOT appear in any output or error.
- **FR-009**: A failure on one platform MUST NOT prevent the other from being attempted; the exit status MUST be non-zero if any attempted platform failed.
- **FR-010**: The YouTube authorization for upload MUST be a separate consent with only the upload permission, runnable through the existing local helper.
- **FR-011**: `--images <folder|list>` MUST publish an Instagram photo carousel (2–10 slides, one shape between 4:5 and 1.91:1, 320–1440 px wide, ≤ 8 MB each as JPEG; PNG slides are converted to JPEG) under the same rules as a video: dry run by default, `--confirm`, `--no-publish`, one temporary public copy per slide deleted afterwards, a record per folder in the published log, never YouTube.

### Key Entities

- **Publication request**: the file, optional experiment number, title/description/caption/tags, chosen platforms, confirmation.
- **Probe**: what the file is — duration, size, dimensions, codecs.
- **Publication record**: file, experiment number, platform, post id and link, visibility, title, time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dry run completes in under 5 seconds for a 40-second Short and changes nothing on any platform or on disk.
- **SC-002**: From a confirmed command to a returned link takes under 2 minutes for a 40-second Short on each platform.
- **SC-003**: 0 publications happen without the confirmation flag (verified by tests that fail if any network call is made in a dry run).
- **SC-004**: 100 % of published videos have a record that includes the post id.
- **SC-005**: 0 credentials appear in outputs, errors or the record (verified by tests).
- **SC-006**: A repeated run for the same file and platform is refused 100 % of the time unless forced.

## Assumptions

- The Instagram account is a Business/Creator account that is a tester on the Meta app (development mode), so publishing to it needs no app review.
- The YouTube API quota (10 000 units/day, ≈ 1 600 per upload) allows several uploads a day.
- Videos are the project's own renders (1080×1920, H.264/AAC, under 100 MB).
- The Google Cloud project is not audited, so YouTube visibility is private until the owner publishes.

## Out of Scope / Known Gaps

- TikTok (needs its own app and audit); browser-assisted posting stays an ad-hoc fallback.
- Carousels with videos or with mixed media (only photo carousels are supported); the Instagram API cannot add music to a carousel — pick the track in the app when posting by hand.
- Scheduling, editing or deleting published posts, thumbnails, playlists, end screens, comments.
- Auto-writing captions from the experiments log (the text is written per video in chat).
- A web UI: the interface is the command, driven through Claude.

## Open Questions

- **YouTube audit.** Submitting the project for Google's API audit would allow public uploads; how soon does the owner want that versus pressing Publish in Studio?
- **Cross-posting cadence.** One command for both platforms, or staggered by hours? (Posting both at once is assumed.)
- **Instagram Reel limits.** Maximum duration and file size for API Reels should be checked against the live API with a first stage-only run.
- **Public copy of an unpublished video.** For a few minutes the Blob address (unguessable, deleted afterwards) is reachable by anyone who has it. Acceptable, or prefer a tunnel straight from this machine?

## Verification status

- **Live (2026-10-16)**: the Instagram publish token works (a `media_publish` call reached the resource check, not a permission error), the resumable upload is rejected (see Clarifications). The `video_url` flow with Blob hosting was run stage-only on a real render: Meta downloaded and processed it, the copy was deleted. The first real Instagram publish is still to run.
- **Live, YouTube (2026-10-16)**: a private upload of `ear-challenge-31.mp4` worked; read back through the Data API it is `private`, not made for kids, with the given title, tags, category 10 and a description carrying the tracking link and `#Shorts` (processing continued afterwards). The rehearsal video is deleted by the owner in Studio.
- **Automated**: 72 tests for the whole publish path with scripted platforms, including: a dry run makes no network call and hosts nothing; the temporary copy is deleted even when Instagram fails; no credential in output or record.
