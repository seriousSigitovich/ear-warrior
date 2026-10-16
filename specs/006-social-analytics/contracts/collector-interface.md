# Contract: Collector interface (`server/src/social/types.ts`)

```ts
interface Collector {
  platform: 'youtube' | 'instagram';
  isConfigured(env): boolean;                       // false → run is skipped, not failed
  collect(ctx: { fetchFn; env; tokens; now }): Promise<{
    posts: { info: PostInfo; metrics: PostMetrics }[];
    account: { followers: number | null; extra: Record<string, number> };
  }>;
}
```

## Rules a collector MUST follow
1. **Unknown is `null`, never 0** (`emptyMetrics()` is all-null).
2. **No secret in an error**: all HTTP goes through `getJson`, which scrubs `access_token|client_secret|refresh_token|token` query values from URLs and surfaces the API's own message (`error.message` / `error_description`).
3. **Secondary data may fail, primary may not**: YouTube Analytics failure → warn and continue with Data API counters; Instagram account insights failure → empty `extra`.
4. **One bad metric must not drop a post**: Instagram requests the whole metric set once; on error it re-requests each metric alone and keeps what succeeds.
5. Pagination is bounded (`MAX_PAGES = 20`).
6. `fetchFn`, token store and clock are injected — no module-level network or time.

## Platform specifics (as built)
| | YouTube | Instagram |
|---|---|---|
| Config | `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | `IG_ACCESS_TOKEN` (seed; then DB) |
| Auth | OAuth refresh → access token per run | long-lived token; refresh when expiry unknown or < 20 days |
| Posts | `channels` → uploads playlist → `playlistItems` → `videos` (batches of 50) | `/me/media` (50 per page) |
| Metrics | views, likes, comments (Data); shares, follows (= subscribersGained), avgWatchS, avgWatchPct (Analytics) | views, reach, saved, shares, `ig_reels_avg_watch_time` (ms → s), follows, profile_visits; likes/comments from media fields |
| Account | subscriberCount | followers_count; profile_views / website_clicks / reach over 28 d |
| Kind | `short` if duration ≤ 180 s | `REELS` → `reel`, else `post` |
