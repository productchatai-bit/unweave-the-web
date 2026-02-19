import { useState } from "react";
import { History, X, ExternalLink, Clock } from "lucide-react";

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

interface HistoryDrawerProps {
  onSelectUrl: (url: string) => void;
}

export function useHistory() {
  const STORAGE_KEY = "site-unraveler-history";

  const getHistory = (): HistoryEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const addHistory = (url: string, title: string) => {
    const existing = getHistory().filter((h) => h.url !== url);
    const updated = [{ url, title, timestamp: Date.now() }, ...existing].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return { getHistory, addHistory };
}

export function HistoryDrawer({ onSelectUrl }: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const { getHistory } = useHistory();
  const history = getHistory();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground transition-all duration-200"
        title="Scrape history"
      >
        <Clock className="w-3.5 h-3.5" />
        History
        {history.length > 0 && (
          <span className="ml-0.5 bg-primary/20 text-primary px-1 rounded text-[10px]">
            {history.length}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border shadow-card transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Recent Scrapes</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No history yet. Start scraping!
            </p>
          ) : (
            history.map((entry, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelectUrl(entry.url);
                  setOpen(false);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {entry.title || "Untitled Page"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {entry.url}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
