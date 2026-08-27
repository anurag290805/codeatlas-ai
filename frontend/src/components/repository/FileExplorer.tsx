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
  /** Currently selected file path. */
  selectedPath?: string;
  /** File content returned by the repository file hook. */
  selectedFile: FileContent | null;
  /** True while the selected file is being fetched. */
  isFileLoading?: boolean;
  /** Error raised while loading the selected file. */
  fileError?: unknown;
  /** Notified whenever the selected file changes. */
  onFileSelect: (path: string) => void;
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
  selectedPath,
  selectedFile,
  isFileLoading = false,
  fileError,
  onFileSelect,
  className,
}: FileExplorerProps) {
  const [internalSelectedPath, setInternalSelectedPath] = useState<string | undefined>(selectedPath);
  const activePath = selectedPath ?? internalSelectedPath;

  const handleSelectFile = (path: string) => {
    setInternalSelectedPath(path);
    onFileSelect(path);
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
              <FileTree nodes={fileTree} selectedPath={activePath} onSelectFile={handleSelectFile} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>
            <div className="h-full overflow-y-auto bg-background">
              {activePath ? (
                <FileViewer
                  file={selectedFile}
                  isLoading={isFileLoading}
                  error={fileError}
                />
              ) : emptyState}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30">
          <FileTree nodes={fileTree} selectedPath={activePath} onSelectFile={handleSelectFile} />
        </div>
        <div className="min-h-[16rem] overflow-y-auto rounded-lg border bg-background">
          {activePath ? (
            <FileViewer file={selectedFile} isLoading={isFileLoading} error={fileError} />
          ) : emptyState}
        </div>
      </div>
    </div>
  );
}
