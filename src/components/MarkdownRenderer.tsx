import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

const components = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => <PreBlock>{children}</PreBlock>,
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components as never}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function PreBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre>{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
        title="Copy code"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in (node as object)) {
    return extractText((node as React.ReactElement).props.children);
  }
  return "";
}
