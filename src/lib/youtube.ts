const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const normalizeCandidate = (value: string | undefined) => {
  if (!value) return "";
  const trimmed = value.trim();
  return YOUTUBE_ID_REGEX.test(trimmed) ? trimmed : "";
};

export const extractYouTubeVideoId = (input: string) => {
  const value = input.trim();
  if (!value) return "";

  const directId = normalizeCandidate(value);
  if (directId) return directId;

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return normalizeCandidate(url.pathname.split("/").filter(Boolean)[0]);
    }

    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      const byQuery = normalizeCandidate(url.searchParams.get("v") ?? undefined);
      if (byQuery) return byQuery;

      const segments = url.pathname.split("/").filter(Boolean);
      const markerIndex = segments.findIndex((segment) => ["embed", "shorts", "live", "v"].includes(segment));
      if (markerIndex >= 0) {
        return normalizeCandidate(segments[markerIndex + 1]);
      }
    }
  } catch {
    // Fall back to regex parsing below.
  }

  const matched = value.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return matched?.[1] ?? "";
};
