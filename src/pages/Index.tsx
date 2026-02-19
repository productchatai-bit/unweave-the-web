import { useState, useEffect, useRef, useCallback } from "react";
import { Network, Download, Copy, Check, BookOpen, AlertTriangle, RefreshCw, Globe, Unlink } from "lucide-react";
import { scrapeUrl, type LayerStatus } from "@/lib/scrapeEngine";
import { LayerLog } from "@/components/LayerLog";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { HistoryDrawer, useHistory } from "@/components/HistoryDrawer";

type AppState = "idle" | "loading" | "success" | "error";

const LOADING_MESSAGES = [
  "Fetching URL...",
  "Trying AllOrigins proxy...",
  "Trying ThingProxy...",
  "Trying CodeTabs proxy...",
  "Running Jina AI reader...",
  "Checking Google Cache...",
  "Checking Wayback Machine...",
  "Trying 12ft.io bypass...",
  "Final fallback attempt...",
  "Cleaning HTML...",
  "Rendering Markdown...",
];

const EXAMPLE_URLS = [
  { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Web_scraping" },
  { label: "GitHub Awesome", url: "https://github.com/sindresorhus/awesome" },
  { label: "Hacker News", url: "https://news.ycombinator.com" },
];

export default function Index() {
  const [url, setUrl] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [markdown, setMarkdown] = useState("");
  const [layers, setLayers] = useState<LayerStatus[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [progressKey, setProgressKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const { getHistory, addHistory } = useHistory();
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore last URL
  useEffect(() => {
    const last = localStorage.getItem("site-unraveler-last-url");
    if (last) setUrl(last);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const startLoadingMessages = () => {
    setLoadingMsgIdx(0);
    if (loadingInterval.current) clearInterval(loadingInterval.current);
    loadingInterval.current = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1800);
  };

  const stopLoadingMessages = () => {
    if (loadingInterval.current) {
      clearInterval(loadingInterval.current);
      loadingInterval.current = null;
    }
  };

  const handleScrape = useCallback(async (targetUrl?: string) => {
    let scrapeUrl_ = targetUrl || url;
    if (!scrapeUrl_) return;

    // Auto-prepend https://
    if (!/^https?:\/\//i.test(scrapeUrl_)) {
      scrapeUrl_ = "https://" + scrapeUrl_;
      if (!targetUrl) setUrl(scrapeUrl_);
    }

    localStorage.setItem("site-unraveler-last-url", scrapeUrl_);
    setAppState("loading");
    setLayers([]);
    setMarkdown("");
    setErrorMsg("");
    setProgressKey((k) => k + 1);
    startLoadingMessages();

    try {
      const result = await scrapeUrl(scrapeUrl_, setLayers);
      stopLoadingMessages();
      setMarkdown(result.markdown);
      setWordCount(result.wordCount);
      setReadTime(result.readTime);
      setAppState("success");
      setActiveTab("preview");

      // Extract title from markdown
      const titleMatch = result.markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : new URL(scrapeUrl_).hostname;
      addHistory(scrapeUrl_, title);
    } catch (e) {
      stopLoadingMessages();
      setErrorMsg("All 8 scraping layers failed — including Google Cache, Wayback Machine, Jina AI, and 12ft.io bypass. The site enforces strict bot protection.");
      setAppState("error");
    }
  }, [url]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScrape();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    showToast("Markdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    const domain = new URL(url).hostname.replace(/\./g, "-");
    const date = new Date().toISOString().split("T")[0];
    a.download = `${domain}-${date}.md`;
    a.click();
    URL.revokeObjectURL(objUrl);
    showToast("Downloading .md file...");
  };

  const handleHistorySelect = (histUrl: string) => {
    setUrl(histUrl);
    handleScrape(histUrl);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Bar */}
      {appState === "loading" && (
        <div
          key={progressKey}
          className="fixed top-0 left-0 h-0.5 bg-gradient-button z-50 animate-progress"
          style={{ width: "100%" }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl glass border border-success/30 text-success text-sm font-medium shadow-glow animate-fade-in-up flex items-center gap-2">
          <Check className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-button flex items-center justify-center shadow-glow-sm">
              <Unlink className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text leading-none">Site Unraveler</h1>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                100% Free · No API Keys · No Limits
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HistoryDrawer onSelectUrl={handleHistorySelect} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* Hero tagline */}
        {appState === "idle" && (
          <div className="text-center py-4 animate-fade-in-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Paste any URL.
              <br />
              <span className="gradient-text">Get clean Markdown instantly.</span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              8-layer scraping engine · Bot bypass · Jina AI · Google Cache · Wayback Machine
            </p>
          </div>
        )}

        {/* URL Input */}
        <div className="surface-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                disabled={appState === "loading"}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none input-focus-ring transition-all duration-200 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => handleScrape()}
              disabled={!url || appState === "loading"}
              className="relative px-6 py-3 rounded-xl font-semibold text-sm text-primary-foreground overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-glow-sm hover:shadow-glow"
              style={{
                background: appState === "loading"
                  ? "hsl(var(--primary))"
                  : "var(--gradient-button)",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                {appState === "loading" ? (
                  <>
                    <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" />
                    </svg>
                    Unraveling...
                  </>
                ) : (
                  <>
                    <Network className="w-4 h-4" />
                    Unravel
                  </>
                )}
              </span>
              {appState !== "loading" && (
                <div className="absolute inset-0 animate-shimmer opacity-20" />
              )}
            </button>
          </div>

          {/* Example pills */}
          {appState === "idle" && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Try:</span>
              {EXAMPLE_URLS.map((ex) => (
                <button
                  key={ex.url}
                  onClick={() => {
                    setUrl(ex.url);
                    handleScrape(ex.url);
                  }}
                  className="text-xs px-3 py-1 rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all duration-200"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {appState === "loading" && (
          <div className="surface-card rounded-2xl p-6 animate-fade-in-up">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin-slow" />
              <p className="text-sm text-muted-foreground font-mono transition-all">
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>
            </div>
            <LayerLog layers={layers} currentMessage={LOADING_MESSAGES[loadingMsgIdx]} />
          </div>
        )}

        {/* Error State */}
        {appState === "error" && (
          <div className="animate-fade-in-up rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Couldn't Unravel This URL</h3>
                <p className="text-sm text-muted-foreground mb-3">{errorMsg}</p>
                <div className="text-xs text-muted-foreground/80 space-y-1 mb-4">
                  <p>• The site may use bot protection (Cloudflare, etc.)</p>
                  <p>• CORS restrictions may block browser-side fetching</p>
                  <p>• The URL may require authentication or be on a private network</p>
                </div>
                {layers.length > 0 && (
                  <LayerLog layers={layers} currentMessage="All layers exhausted" />
                )}
                <button
                  onClick={() => setAppState("idle")}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border hover:border-primary/40 text-sm text-foreground transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Output */}
        {appState === "success" && markdown && (
          <div className="animate-fade-in-up space-y-3">
            {/* Action bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
                  {(["preview", "raw"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all duration-200 ${
                        activeTab === tab
                          ? "bg-card text-foreground shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "preview" ? "Preview" : "Raw"}
                    </button>
                  ))}
                </div>

                {/* Stats badge */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{wordCount.toLocaleString()} words · {readTime} min read</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:border-primary/40 hover:bg-primary/5 text-xs font-medium text-foreground transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "var(--gradient-button)" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
            </div>

            {/* Output panel */}
            <div className="surface-card rounded-2xl overflow-hidden">
              {activeTab === "preview" ? (
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <MarkdownRenderer content={markdown} />
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    readOnly
                    value={markdown}
                    className="w-full h-[70vh] p-6 bg-transparent font-mono text-xs text-muted-foreground resize-none focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground/50">
        © Site Unraveler
      </footer>
    </div>
  );
}
