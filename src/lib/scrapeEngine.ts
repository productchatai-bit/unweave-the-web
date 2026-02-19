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

function cleanHtmlToMarkdown(html: string, sourceUrl: string, layersTriedCount: number): string {
  const td = initTurndown();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove noise
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

  // Extract main content
  const contentSelectors = [
    "article", "main", '[role="main"]',
    ".content", ".post-content", ".entry-content", ".article-body",
    "body",
  ];
  let mainEl: Element | null = null;
  for (const sel of contentSelectors) {
    mainEl = doc.querySelector(sel);
    if (mainEl) break;
  }
  const rawHtml = mainEl ? mainEl.innerHTML : doc.body?.innerHTML ?? "";

  let markdown = td.turndown(rawHtml);

  // Clean excessive blank lines
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  // Prepend metadata
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
    { layer: 2, name: "CorsProxy.io", status: "pending" },
    { layer: 3, name: "CodeTabs", status: "pending" },
    { layer: 4, name: "Jina Reader", status: "pending" },
    { layer: 5, name: "Direct Fetch", status: "pending" },
  ];

  const updateLayer = (index: number, status: LayerStatus["status"]) => {
    layers[index] = { ...layers[index], status };
    onLayerUpdate([...layers]);
  };

  // Layer 1 — AllOrigins
  updateLayer(0, "trying");
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodedURL}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.contents && data.contents.length > 200) {
        updateLayer(0, "success");
        const md = cleanHtmlToMarkdown(data.contents, url, 1);
        return makeResult(md);
      }
    }
  } catch {}
  updateLayer(0, "failed");

  // Layer 2 — CorsProxy.io
  updateLayer(1, "trying");
  try {
    const res = await fetch(`https://corsproxy.io/?${encodedURL}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200) {
        updateLayer(1, "success");
        const md = cleanHtmlToMarkdown(html, url, 2);
        return makeResult(md);
      }
    }
  } catch {}
  updateLayer(1, "failed");

  // Layer 3 — CodeTabs
  updateLayer(2, "trying");
  try {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodedURL}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200) {
        updateLayer(2, "success");
        const md = cleanHtmlToMarkdown(html, url, 3);
        return makeResult(md);
      }
    }
  } catch {}
  updateLayer(2, "failed");

  // Layer 4 — Jina Reader
  updateLayer(3, "trying");
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/markdown,text/plain,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) {
        updateLayer(3, "success");
        const md = buildJinaMarkdown(text, url, 4);
        return makeResult(md);
      }
    }
  } catch {}
  updateLayer(3, "failed");

  // Layer 5 — Direct fetch (no-cors fallback)
  updateLayer(4, "trying");
  try {
    const res = await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(5000) });
    // no-cors returns opaque response, won't have readable content
    // just attempt and fail gracefully
    void res;
  } catch {}
  updateLayer(4, "failed");

  throw new Error("All layers failed");
}

function makeResult(markdown: string): ScrapeResult {
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const readTime = Math.ceil(wordCount / 200);
  return { markdown, layersTriedCount: 0, wordCount, readTime };
}
