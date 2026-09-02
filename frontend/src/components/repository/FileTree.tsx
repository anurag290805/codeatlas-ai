import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/types";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string | null;
  onSelectFile: (path: string) => void;
  /**
   * Invoked the first time a directory whose `children` is `undefined` is
   * expanded. Wiring this to a data-fetching hook at the call site is what
   * enables lazy loading; FileTree itself never fetches data.
   */
  onExpandDirectory?: (node: FileTreeNode) => void;
  defaultExpandedPaths?: string[];
  className?: string;
}

interface FlatNode {
  node: FileTreeNode;
  depth: number;
  hasChildren: boolean;
}

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "go",
  "rs",
  "java",
  "rb",
  "php",
  "c",
  "cpp",
  "cs",
  "swift",
  "kt",
]);
const TEXT_EXTENSIONS = new Set(["md", "mdx", "txt"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"]);

function getFileIcon(name: string): LucideIcon {
  const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (extension === "json") return FileJson;
  if (CODE_EXTENSIONS.has(extension)) return FileCode;
  if (TEXT_EXTENSIONS.has(extension)) return FileText;
  if (IMAGE_EXTENSIONS.has(extension)) return FileType;
  return File;
}

function flattenVisibleNodes(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];

  for (const node of nodes) {
    const hasChildren = node.type === "directory";
    result.push({ node, depth, hasChildren });

    if (node.type === "directory" && expandedPaths.has(node.path) && node.children) {
      result.push(...flattenVisibleNodes(node.children, expandedPaths, depth + 1));
    }
  }

  return result;
}

export function FileTree({
  nodes,
  selectedPath = null,
  onSelectFile,
  onExpandDirectory,
  defaultExpandedPaths = [],
  className,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(defaultExpandedPaths),
  );
  const [focusedPath, setFocusedPath] = useState<string | null>(
    selectedPath ?? nodes[0]?.path ?? null,
  );
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const visibleNodes = useMemo(
    () => flattenVisibleNodes(nodes, expandedPaths),
    [nodes, expandedPaths],
  );

  const focusRow = useCallback((path: string) => {
    setFocusedPath(path);
    rowRefs.current.get(path)?.focus();
  }, []);

  const toggleDirectory = useCallback(
    (node: FileTreeNode) => {
      setExpandedPaths((previous) => {
        const next = new Set(previous);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
          if (node.children === undefined) {
            onExpandDirectory?.(node);
          }
        }
        return next;
      });
    },
    [onExpandDirectory],
  );

  const handleActivate = useCallback(
    (node: FileTreeNode) => {
      if (node.type === "directory") {
        toggleDirectory(node);
      } else {
        onSelectFile(node.path);
      }
    },
    [toggleDirectory, onSelectFile],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, flatNode: FlatNode) => {
      const index = visibleNodes.findIndex((entry) => entry.node.path === flatNode.node.path);

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const next = visibleNodes[index + 1];
          if (next) focusRow(next.node.path);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const previous = visibleNodes[index - 1];
          if (previous) focusRow(previous.node.path);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (flatNode.node.type === "directory") {
            if (!expandedPaths.has(flatNode.node.path)) {
              toggleDirectory(flatNode.node);
            } else {
              const next = visibleNodes[index + 1];
              if (next && next.depth > flatNode.depth) focusRow(next.node.path);
            }
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (flatNode.node.type === "directory" && expandedPaths.has(flatNode.node.path)) {
            toggleDirectory(flatNode.node);
          } else if (flatNode.depth > 0) {
            for (let i = index - 1; i >= 0; i -= 1) {
              if (visibleNodes[i].depth < flatNode.depth) {
                focusRow(visibleNodes[i].node.path);
                break;
              }
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          handleActivate(flatNode.node);
          break;
        }
        default:
          break;
      }
    },
    [visibleNodes, expandedPaths, toggleDirectory, focusRow, handleActivate],
  );

  if (nodes.length === 0) {
    return (
      <div className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}>
        This repository has no files to display.
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Repository files" className={cn("select-none py-1", className)}>
      {visibleNodes.map((flatNode) => {
        const { node, depth, hasChildren } = flatNode;
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = selectedPath === node.path;
        const isFocused = focusedPath === node.path;
        const Icon =
          node.type === "directory"
            ? isExpanded
              ? FolderOpen
              : Folder
            : getFileIcon(node.name);

        return (
          <div
            key={node.path}
            ref={(element) => {
              if (element) rowRefs.current.set(node.path, element);
              else rowRefs.current.delete(node.path);
            }}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={isSelected}
            aria-level={depth + 1}
            tabIndex={isFocused ? 0 : -1}
            onFocus={() => setFocusedPath(node.path)}
            onKeyDown={(event) => handleKeyDown(event, flatNode)}
            onClick={() => {
              setFocusedPath(node.path);
              handleActivate(node);
            }}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-sm",
              "transition-colors hover:bg-muted/60",
              isSelected && "bg-accent text-accent-foreground",
            )}
          >
            {node.type === "directory" ? (
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {node.type === "directory" && node.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  node.type === "directory" ? "text-primary" : "text-muted-foreground",
                )}
              />
            )}

            <span className="truncate">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}
