// src/components/chat/ChatEmptyState.tsx

import type { FC } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Bug,
  FileSearch,
  Network,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface ExamplePrompt {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly prompt: string;
}

export interface ChatEmptyStateProps {
  repositoryName: string;
  examplePrompts?: readonly ExamplePrompt[];
  onSelectPrompt: (prompt: string) => void;
  className?: string;
}

const DEFAULT_PROMPTS: ExamplePrompt[] = [
  { icon: BookOpen, title: "Explain this project", prompt: "Explain what this project does and how it's organized." },
  { icon: Network, title: "Show architecture", prompt: "Give me a high-level overview of the architecture." },
  { icon: Bug, title: "Find bugs", prompt: "Look for likely bugs or edge cases that aren't handled." },
  { icon: ShieldCheck, title: "Review repository", prompt: "Review this repository for code quality issues." },
  { icon: FileSearch, title: "Where is X defined?", prompt: "Where is authentication handled in this codebase?" },
  { icon: Sparkles, title: "Generate documentation", prompt: "Generate documentation for the main entry point." },
];

/**
 * The first-run state for a conversation: a quiet AI mark, a short prompt,
 * and a grid of example questions scoped to the active repository.
 */
export const ChatEmptyState: FC<ChatEmptyStateProps> = ({
  repositoryName,
  examplePrompts = DEFAULT_PROMPTS,
  onSelectPrompt,
  className,
}) => {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10"
      >
        <Sparkles className="h-6 w-6 text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Ask anything about {repositoryName}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-1.5 max-w-sm text-sm text-muted-foreground"
      >
        Answers are grounded in the indexed source &mdash; every claim links back to the exact file and line.
      </motion.p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {examplePrompts.map((item, index) => (
          <motion.button
            key={item.title}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12 + index * 0.04 }}
            onClick={() => onSelectPrompt(item.prompt)}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 text-left backdrop-blur-sm transition-colors",
              "hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:text-primary">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.prompt}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatEmptyState;
