// Reads the comments under our own videos. Read-only: nothing is posted from here.
//   YouTube  — Data API v3 commentThreads (needs the youtube.force-ssl scope: `npm run yt:auth -- --comments`)
//   Instagram — Graph API /{media}/comments (needs instagram_business_manage_comments on the token)
import { getJson } from '../social/http.js';

export interface Comment {
  platform: 'youtube' | 'instagram';
  postId: string;
  postTitle: string;
  postUrl: string;
  commentId: string;
  author: string;
  text: string;
  at: string; // ISO
  /** The channel/account has already answered in this thread. */
  answered: boolean;
}

const YT = 'https://www.googleapis.com/youtube/v3';
const IG = 'https://graph.instagram.com/v23.0';

export async function youtubeAccessToken(fetchFn: typeof fetch, env: NodeJS.ProcessEnv, refreshToken: string): Promise<string> {
  const res = await getJson<{ access_token: string }>(fetchFn, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YT_CLIENT_ID ?? '',
      client_secret: env.YT_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  return res.access_token;
}

interface YtThread {
  id: string;
  snippet: {
    totalReplyCount: number;
    topLevelComment: { id: string; snippet: { authorDisplayName: string; authorChannelId?: { value: string }; textOriginal: string; publishedAt: string } };
  };
  replies?: { comments: { snippet: { authorChannelId?: { value: string } } }[] };
}

export async function youtubeComments(fetchFn: typeof fetch, token: string): Promise<Comment[]> {
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const ch = await getJson<{ items: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    fetchFn, `${YT}/channels?part=contentDetails&mine=true`, auth);
  const me = ch.items[0];
  if (!me) throw new Error('YouTube: no channel on this Google account');

  const videos: { id: string; title: string }[] = [];
  let page = '';
  do {
    const q = new URLSearchParams({ part: 'snippet', playlistId: me.contentDetails.relatedPlaylists.uploads, maxResults: '50' });
    if (page) q.set('pageToken', page);
    const j = await getJson<{ items: { snippet: { title: string; resourceId: { videoId: string } } }[]; nextPageToken?: string }>(
      fetchFn, `${YT}/playlistItems?${q}`, auth);
    for (const i of j.items) videos.push({ id: i.snippet.resourceId.videoId, title: i.snippet.title });
    page = j.nextPageToken ?? '';
  } while (page);

  const out: Comment[] = [];
  for (const v of videos) {
    let p = '';
    do {
      const q = new URLSearchParams({ part: 'snippet,replies', videoId: v.id, maxResults: '100', textFormat: 'plainText' });
      if (p) q.set('pageToken', p);
      let j: { items: YtThread[]; nextPageToken?: string };
      try {
        j = await getJson(fetchFn, `${YT}/commentThreads?${q}`, auth);
      } catch (err) {
        // Comments turned off on a video: 403 commentsDisabled. Skip it, keep the rest.
        if (/disabled/i.test((err as Error).message)) break;
        throw err;
      }
      for (const t of j.items) {
        const s = t.snippet.topLevelComment.snippet;
        if (s.authorChannelId?.value === me.id) continue; // our own link comment
        out.push({
          platform: 'youtube', postId: v.id, postTitle: v.title, postUrl: `https://www.youtube.com/shorts/${v.id}`,
          commentId: t.snippet.topLevelComment.id, author: s.authorDisplayName, text: s.textOriginal, at: s.publishedAt,
          // `replies` holds up to 5; enough to see whether we have answered.
          answered: (t.replies?.comments ?? []).some((c) => c.snippet.authorChannelId?.value === me.id),
        });
      }
      p = j.nextPageToken ?? '';
    } while (p);
  }
  return out;
}

/** Post a reply under a comment, as the channel/account. Returns the new comment's id. */
export async function postReply(fetchFn: typeof fetch, c: Comment, text: string, tokens: { youtube?: string; instagram?: string }): Promise<string> {
  if (c.platform === 'youtube') {
    if (!tokens.youtube) throw new Error('no YouTube token');
    const j = await getJson<{ id: string }>(fetchFn, `${YT}/comments?part=snippet`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens.youtube}`, 'content-type': 'application/json' },
      body: JSON.stringify({ snippet: { parentId: c.commentId, textOriginal: text } }),
    });
    return j.id;
  }
  if (!tokens.instagram) throw new Error('no Instagram token');
  const j = await getJson<{ id: string }>(fetchFn, `${IG}/${c.commentId}/replies`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: text, access_token: tokens.instagram }),
  });
  return j.id;
}

interface IgComment {
  id: string;
  text: string;
  username?: string;
  timestamp: string;
  replies?: { data: { username?: string }[] };
}

export async function instagramComments(fetchFn: typeof fetch, token: string): Promise<Comment[]> {
  const me = await getJson<{ username: string }>(fetchFn, `${IG}/me?fields=username&access_token=${token}`);
  const media: { id: string; caption?: string; permalink: string; comments_count: number }[] = [];
  let next: string | undefined = `${IG}/me/media?fields=id,caption,permalink,comments_count&limit=50&access_token=${token}`;
  while (next) {
    const j: { data: typeof media; paging?: { next?: string } } = await getJson(fetchFn, next);
    media.push(...j.data);
    next = j.paging?.next;
  }
  const out: Comment[] = [];
  let hidden = 0;
  for (const m of media.filter((x) => x.comments_count > 0)) {
    let url: string | undefined = `${IG}/${m.id}/comments?fields=id,text,username,timestamp,replies{username}&limit=50&access_token=${token}`;
    let seen = 0;
    while (url) {
      const j: { data: IgComment[]; paging?: { next?: string } } = await getJson(fetchFn, url);
      for (const c of j.data) {
        seen++;
        if (c.username === me.username) continue;
        out.push({
          platform: 'instagram', postId: m.id, postTitle: (m.caption ?? '').split('\n')[0].slice(0, 70), postUrl: m.permalink,
          commentId: c.id, author: c.username ?? '?', text: c.text, at: c.timestamp,
          answered: (c.replies?.data ?? []).some((r) => r.username === me.username),
        });
      }
      url = j.paging?.next;
    }
    if (seen === 0) hidden++;
  }
  // Without instagram_business_manage_comments the API answers with empty pages instead of an error.
  if (hidden > 0 && out.length === 0) {
    throw new Error('Instagram returned no comment text — the token lacks instagram_business_manage_comments (see server/README.md → Comments)');
  }
  return out;
}
