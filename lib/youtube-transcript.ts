import { fetchWithTimeout, readTextWithLimit } from "@/lib/safe-fetch";

// Best-effort YouTube transcript fetcher. There is no official public API for
// this — we read the caption track list YouTube embeds in the watch page and
// fetch the timedtext track directly, which is the same mechanism most
// "youtube transcript" libraries use. This only works for videos that have
// captions (manual or auto-generated) enabled; anything else fails cleanly.

const VIDEO_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/;

export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) {
    return null;
  }
  const match = url.match(VIDEO_ID_RE);
  return match ? match[1] : null;
}

type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function fetchYoutubeTranscript(videoId: string): Promise<{ title: string; text: string }> {
  const pageRes = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "accept-language": "fr,ar;q=0.9,en;q=0.8" },
  }, 15_000);
  if (!pageRes.ok) throw new Error("YOUTUBE_PAGE_FETCH_FAILED");
  const html = await readTextWithLimit(pageRes, 5 * 1024 * 1024);

  const titleMatch = html.match(/<meta name="title" content="([^"]+)"/);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "Cours vidéo YouTube";

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])(?=,")/);
  if (!tracksMatch) throw new Error("YOUTUBE_NO_CAPTIONS");

  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(tracksMatch[1]);
  } catch {
    throw new Error("YOUTUBE_NO_CAPTIONS");
  }
  if (!tracks || tracks.length === 0) throw new Error("YOUTUBE_NO_CAPTIONS");

  // Prefer a manually-authored French or Arabic track, then any manual track,
  // then fall back to auto-generated ("asr") captions in whatever language exists.
  const track =
    tracks.find(t => /^(fr|ar)/.test(t.languageCode) && t.kind !== "asr") ??
    tracks.find(t => t.kind !== "asr") ??
    tracks[0];

  const captionUrl = track.baseUrl.replace(/\\u0026/g, "&");
  let parsedCaptionUrl: URL;
  try {
    parsedCaptionUrl = new URL(captionUrl);
  } catch {
    throw new Error("YOUTUBE_CAPTIONS_FETCH_FAILED");
  }
  if (parsedCaptionUrl.protocol !== "https:" || !/(^|\\.)youtube\.com$|(^|\\.)googlevideo\.com$/.test(parsedCaptionUrl.hostname)) {
    throw new Error("YOUTUBE_CAPTIONS_FETCH_FAILED");
  }
  const captionRes = await fetchWithTimeout(parsedCaptionUrl, {}, 15_000);
  if (!captionRes.ok) throw new Error("YOUTUBE_CAPTIONS_FETCH_FAILED");
  const xml = await readTextWithLimit(captionRes, 10 * 1024 * 1024);

  const text = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 200) throw new Error("YOUTUBE_TRANSCRIPT_TOO_SHORT");
  return { title, text };
}
