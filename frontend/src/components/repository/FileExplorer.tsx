// src/components/repository/FileExplorer.tsx
import { useState } from "react";
import { FileQuestion } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "@/components/repository/FileTree";
import { FileViewer } from "@/components/repository/FileViewer";
import type { FileContent, FileTreeNode } from "@/types";

interface FileExplorerProps {
  /** Hierarchical file structure for the repository. */
  fileTree: FileTreeNode[];
  /** File contents keyed by path, pre-loaded by the parent. */
  fileContents: Record<string, FileContent>;
  /** Path selected by default when the explorer first renders. */
  defaultSelectedPath?: string;
  /** Notified whenever the selected file changes. */
  onFileSelect?: (path: string) => void;
  className?: string;
}

/**
 * Composes the repository browsing experience — a file tree on the
 * left and a file viewer on the right — in a resizable, IDE-style
 * layout on desktop and a stacked layout on mobile.
 *
 * Purely presentational: all file data is supplied via props, and the
 * only state owned here is which path is currently selected.
 */
export function FileExplorer({
  fileTree,
  fileContents,
  defaultSelectedPath,
  onFileSelect,
  className,
}: FileExplorerProps) {
  const [selectedPath, setSelectedPath] = useState<string | undefined>(defaultSelectedPath);

  const selectedFile = selectedPath ? (fileContents[selectedPath] ?? null) : null;

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
    onFileSelect?.(path);
  };

  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No file selected</p>
      <p className="text-xs text-muted-foreground">
        Choose a file from the tree to view its contents.
      </p>
    </div>
  );

  return (
    <div className={className}>
      <div className="hidden h-full overflow-hidden rounded-lg border md:flex">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={25} minSize={15} maxSize={45}>
            <div className="h-full overflow-y-auto border-r bg-muted/30">
              <FileTree nodes={fileTree} selectedPath={selectedPath} onSelectFile={handleSelectFile} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>
            <div className="h-full overflow-y-auto bg-background">
              {selectedFile ? <FileViewer file={selectedFile} /> : emptyState}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30">
          <FileTree nodes={fileTree} selectedPath={selectedPath} onSelectFile={handleSelectFile} />
        </div>
        <div className="min-h-[16rem] overflow-y-auto rounded-lg border bg-background">
          {selectedFile ? <FileViewer file={selectedFile} /> : emptyState}
        </div>
      </div>
    </div>
  );
}
