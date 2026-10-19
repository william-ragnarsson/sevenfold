/**
 * Display helpers for a research source. Gemini's grounding returns opaque
 * redirect URLs (vertexaisearch…/grounding-api-redirect/…) rather than the real
 * page URL, so for those we can't show a meaningful domain or favicon.
 */

const REDIRECT_HOSTS = ["vertexaisearch.cloud.google.com", "grounding-api-redirect"];

/** The hostname for a real source URL, or null for opaque redirect links. */
export function domainOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (REDIRECT_HOSTS.some((h) => url.includes(h))) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * A favicon URL for a real domain, or null when there's no usable domain.
 * `size` is the pixel size asked for; sites without an icon that large get
 * the largest one they have.
 */
export function faviconOf(url: string, size = 64): string | null {
  const domain = domainOf(url);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
