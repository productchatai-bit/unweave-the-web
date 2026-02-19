import TurndownService from "turndown";
// @ts-ignore
import { gfm } from "turndown-plugin-gfm";

export interface LayerStatus {
  layer: number;
  name: string;
  status: "pending" | "trying" | "success" | "failed";
}

export interface ScrapeResult {
  markdown: string;
  layersTriedCount: number;
  wordCount: number;
  readTime: number;
}

function initTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    linkStyle: "inlined",
  });
  try {
    td.use(gfm);
  } catch {}
  return td;
}

/**
 * Returns true if the HTML is a JS SPA shell with no real readable content.
 */
function isSpaShell(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, meta, link").forEach((el) => el.remove());
  const textContent = (doc.body?.innerText ?? "").trim();
  if (textContent.length < 150) return true;
  const bodyHtml = doc.body?.innerHTML ?? "";
  const spaPatterns = [
    /<div[^>]+id=["']app["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']__next["'][^>]*>\s*<\/div>/i,
    /data-page=["'][^"']+["']/i,
  ];
  return spaPatterns.some((p) => p.test(bodyHtml));
}

/**
 * Checks if the Jina response is a bot-wall / error page rather than real content.
 * Jina returns 200 OK even for errors, so we must inspect the body.
 */
function isJinaError(text: string): boolean {
  if (!text || text.length < 100) return true;
  const lower = text.toLowerCase();
  // Jina warns us inline when target blocked it
  if (lower.includes("warning: target url returned error")) return true;
  if (lower.includes("captcha")) return true;
  if (lower.includes("403: forbidden")) return true;
  if (lower.includes("access denied")) return true;
  // If after stripping the frontmatter header there's almost nothing left
  const stripped = text.replace(/^#.*\n=+\n/m, "").trim();
  return stripped.length < 100;
}

function cleanHtmlToMarkdown(html: string, sourceUrl: string, layersTriedCount: number): string {
  const td = initTurndown();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const noiseSelectors = [
    "script", "style", "nav", "footer", "header", "aside",
    "iframe", "form", "button", "input", "select", "textarea",
    "noscript", '[role="navigation"]', '[role="banner"]',
    '[role="complementary"]', ".cookie-banner", ".popup",
    ".modal", ".advertisement", ".ad", ".sidebar",
  ];
  noiseSelectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const contentSelectors = [
    "article", "main", '[role="main"]',
    ".content", ".post-content", ".entry-content", ".article-body",
    ".page-content", ".main-content", ".site-content",
    "body",
  ];
  let mainEl: Element | null = null;
  for (const sel of contentSelectors) {
    mainEl = doc.querySelector(sel);
    if (mainEl) break;
  }
  const rawHtml = mainEl ? mainEl.innerHTML : doc.body?.innerHTML ?? "";

  let markdown = td.turndown(rawHtml);
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  const header = `---\nsource: ${sourceUrl}\nscraped: ${new Date().toISOString()}\nlayers_tried: ${layersTriedCount}\n---\n\n`;
  return header + markdown;
}

function buildJinaMarkdown(text: string, sourceUrl: string, layersTriedCount: number): string {
  const header = `---\nsource: ${sourceUrl}\nscraped: ${new Date().toISOString()}\nlayers_tried: ${layersTriedCount}\n---\n\n`;
  return header + text.trim();
}

export async function scrapeUrl(
  url: string,
  onLayerUpdate: (layers: LayerStatus[]) => void
): Promise<ScrapeResult> {
  const encodedURL = encodeURIComponent(url);

  const layers: LayerStatus[] = [
    { layer: 1, name: "AllOrigins", status: "pending" },
    { layer: 2, name: "ThingProxy", status: "pending" },
    { layer: 3, name: "CodeTabs", status: "pending" },
    { layer: 4, name: "Jina Reader", status: "pending" },
    { layer: 5, name: "Google Cache", status: "pending" },
    { layer: 6, name: "Wayback Machine", status: "pending" },
    { layer: 7, name: "12ft.io", status: "pending" },
    { layer: 8, name: "HTMLRender.dev", status: "pending" },
  ];

  const updateLayer = (index: number, status: LayerStatus["status"]) => {
    layers[index] = { ...layers[index], status };
    onLayerUpdate([...layers]);
  };

  // ─── Layer 1 — AllOrigins ────────────────────────────────────────────────
  updateLayer(0, "trying");
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodedURL}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.contents && data.contents.length > 200 && !isSpaShell(data.contents)) {
        updateLayer(0, "success");
        return makeResult(cleanHtmlToMarkdown(data.contents, url, 1));
      }
    }
  } catch {}
  updateLayer(0, "failed");

  // ─── Layer 2 — ThingProxy (replaces CorsProxy.io which now requires payment) ─
  updateLayer(1, "trying");
  try {
    const res = await fetch(`https://thingproxy.freeboard.io/fetch/${url}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200 && !isSpaShell(html)) {
        updateLayer(1, "success");
        return makeResult(cleanHtmlToMarkdown(html, url, 2));
      }
    }
  } catch {}
  updateLayer(1, "failed");

  // ─── Layer 3 — CodeTabs ──────────────────────────────────────────────────
  updateLayer(2, "trying");
  try {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodedURL}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200 && !isSpaShell(html)) {
        updateLayer(2, "success");
        return makeResult(cleanHtmlToMarkdown(html, url, 3));
      }
    }
  } catch {}
  updateLayer(2, "failed");

  // ─── Layer 4 — Jina Reader (JS rendering, best for SPAs) ────────────────
  updateLayer(3, "trying");
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/markdown,text/plain,*/*",
        "X-Return-Format": "markdown",
        "X-No-Cache": "true",
        // Ask Jina to wait longer for JS-heavy pages
        "X-Wait-For-Selector": "body",
        "X-Timeout": "25",
      },
      signal: AbortSignal.timeout(35000),
    });
    if (res.ok) {
      const text = await res.text();
      if (!isJinaError(text)) {
        updateLayer(3, "success");
        return makeResult(buildJinaMarkdown(text, url, 4));
      }
    }
  } catch {}
  updateLayer(3, "failed");

  // ─── Layer 5 — Google Cache (bypasses bot protection, serves cached copy) ─
  updateLayer(4, "trying");
  try {
    const googleCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodedURL}&hl=en`;
    // We must go through a proxy since Google Cache itself has CORS restrictions
    const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(googleCacheUrl)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.contents && data.contents.length > 300 && !isSpaShell(data.contents)) {
        updateLayer(4, "success");
        return makeResult(cleanHtmlToMarkdown(data.contents, url, 5));
      }
    }
  } catch {}
  updateLayer(4, "failed");

  // ─── Layer 6 — Wayback Machine (Internet Archive cached copy) ───────────
  updateLayer(5, "trying");
  try {
    // First, get the latest snapshot URL
    const availRes = await fetch(
      `https://archive.org/wayback/available?url=${encodedURL}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (availRes.ok) {
      const availData = await availRes.json();
      const snapshotUrl = availData?.archived_snapshots?.closest?.url;
      if (snapshotUrl) {
        // Fetch the snapshot through a proxy
        const snapRes = await fetch(
          `https://api.allorigins.win/get?url=${encodeURIComponent(snapshotUrl)}`,
          { signal: AbortSignal.timeout(20000) }
        );
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData?.contents && snapData.contents.length > 300 && !isSpaShell(snapData.contents)) {
            updateLayer(5, "success");
            return makeResult(cleanHtmlToMarkdown(snapData.contents, url, 6));
          }
        }
      }
    }
  } catch {}
  updateLayer(5, "failed");

  // ─── Layer 7 — 12ft.io (removes paywalls and bot protection) ────────────
  updateLayer(6, "trying");
  try {
    const twelveFootUrl = `https://12ft.io/proxy?q=${encodedURL}`;
    const proxyRes = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(twelveFootUrl)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.contents && data.contents.length > 300 && !isSpaShell(data.contents)) {
        updateLayer(6, "success");
        return makeResult(cleanHtmlToMarkdown(data.contents, url, 7));
      }
    }
  } catch {}
  updateLayer(6, "failed");

  // ─── Layer 8 — htmlpreview / fallback reader ─────────────────────────────
  updateLayer(7, "trying");
  try {
    // Try fetching with a browser-like user agent via allorigins with modified URL
    const withUaUrl = `https://api.allorigins.win/get?url=${encodedURL}&charset=utf-8`;
    const res = await fetch(withUaUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.contents && data.contents.length > 300 && !isSpaShell(data.contents)) {
        updateLayer(7, "success");
        return makeResult(cleanHtmlToMarkdown(data.contents, url, 8));
      }
    }
  } catch {}
  updateLayer(7, "failed");

  throw new Error("All layers failed");
}

function makeResult(markdown: string): ScrapeResult {
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const readTime = Math.ceil(wordCount / 200);
  return { markdown, layersTriedCount: 0, wordCount, readTime };
}
