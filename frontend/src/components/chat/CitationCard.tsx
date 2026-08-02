import { useState } from "react";
import { Check, Copy, ExternalLink, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Citation } from "@/types";

interface CitationCardProps {
  citation: Citation;
  onOpenFile?: (citation: Citation) => void;
  className?: string;
}

const COPY_FEEDBACK_DURATION_MS = 1500;

function formatLineRange(startLine?: number, endLine?: number): string | null {
  if (startLine == null) return null;
  if (endLine == null || endLine === startLine) return `L${startLine}`;
  return `L${startLine}-${endLine}`;
}

function buildCitationReference(citation: Citation): string {
  const lineRange = formatLineRange(citation.startLine, citation.endLine);
  return lineRange ? `${citation.filePath}:${lineRange}` : citation.filePath;
}

export function CitationCard({ citation, onOpenFile, className }: CitationCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const lineRange = formatLineRange(citation.startLine, citation.endLine);
  const fileName = citation.filePath.split("/").pop() ?? citation.filePath;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCitationReference(citation));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch {
      // Clipboard access can be denied by the browser; the UI simply stays
      // in its un-copied state rather than surfacing a disruptive error.
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col gap-2 border-border/60 bg-muted/30 p-3 text-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{fileName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {citation.filePath}
            </p>
          </div>
        </div>
        {typeof citation.relevanceScore === "number" && (
          <Badge variant="outline" className="shrink-0 font-normal">
            {Math.round(citation.relevanceScore * 100)}% match
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {citation.symbolName && (
          <Badge variant="outline" className="font-normal">
            {citation.symbolName}
          </Badge>
        )}
        {lineRange && (
          <Badge variant="outline" className="font-normal">
            {lineRange}
          </Badge>
        )}
      </div>

      {citation.codePreview && (
        <pre className="max-h-28 overflow-auto rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-foreground">
          <code>{citation.codePreview}</code>
        </pre>
      )}

      <div className="mt-1 flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => onOpenFile?.(citation)}
        >
          <ExternalLink className="h-3 w-3" />
          Open File
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={handleCopy}
        >
          {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {isCopied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}