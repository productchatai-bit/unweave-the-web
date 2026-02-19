import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { LayerStatus } from "@/lib/scrapeEngine";

interface LayerLogProps {
  layers: LayerStatus[];
  currentMessage: string;
}

const statusIcon = (status: LayerStatus["status"]) => {
  switch (status) {
    case "trying":
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
    case "success":
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const statusLabel = (status: LayerStatus["status"]) => {
  switch (status) {
    case "trying": return "Trying...";
    case "success": return "Success";
    case "failed": return "Failed";
    default: return "Pending";
  }
};

export function LayerLog({ layers, currentMessage }: LayerLogProps) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-mono text-muted-foreground mb-2">{currentMessage}</p>
      {layers.map((layer) => (
        <div
          key={layer.layer}
          className={`flex items-center gap-2 text-xs font-mono transition-all duration-300 ${
            layer.status === "pending" ? "opacity-40" : "opacity-100"
          }`}
        >
          {statusIcon(layer.status)}
          <span className="text-muted-foreground">
            Layer {layer.layer} ({layer.name}):
          </span>
          <span
            className={
              layer.status === "success"
                ? "text-success"
                : layer.status === "failed"
                ? "text-destructive"
                : layer.status === "trying"
                ? "text-primary"
                : "text-muted-foreground"
            }
          >
            {statusLabel(layer.status)}
          </span>
        </div>
      ))}
    </div>
  );
}
