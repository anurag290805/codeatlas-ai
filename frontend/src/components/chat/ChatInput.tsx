import { useEffect, useRef, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CornerDownLeft, Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 4000;

const chatInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a message before sending.")
    .max(MAX_MESSAGE_LENGTH, `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`),
});

type ChatInputValues = z.infer<typeof chatInputSchema>;

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export function ChatInput({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Ask a question about this repository…",
  maxLength = MAX_MESSAGE_LENGTH,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDisabled = disabled || isLoading;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<ChatInputValues>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: { message: "" },
    mode: "onChange",
  });

  const messageValue = watch("message") ?? "";
  const { ref: registerRef, ...messageField } = register("message");

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [messageValue]);

  const submitMessage = handleSubmit(({ message }) => {
    if (isDisabled) return;
    onSubmit(message.trim());
    reset({ message: "" });
    requestAnimationFrame(() => textareaRef.current?.focus());
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const characterCount = messageValue.length;
  const isNearLimit = characterCount > maxLength * 0.9;

  return (
    <form onSubmit={submitMessage} className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 p-2 transition-colors",
          "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <Textarea
          {...messageField}
          ref={(element) => {
            registerRef(element);
            textareaRef.current = element;
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          maxLength={maxLength}
          rows={1}
          className={cn(
            "max-h-[200px] min-h-[40px] resize-none border-0 bg-transparent px-2 py-1.5 shadow-none",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
          )}
        />

        <Button
          type="submit"
          size="icon"
          disabled={isDisabled || !isValid || messageValue.trim().length === 0}
          className="h-9 w-9 shrink-0"
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" />
          Enter to send · Shift+Enter for a new line
        </span>
        <motion.span
          animate={{ color: isNearLimit ? "var(--destructive)" : undefined }}
          className={cn("tabular-nums", errors.message && "text-destructive")}
        >
          {characterCount}/{maxLength}
        </motion.span>
      </div>

      {errors.message && (
        <p className="px-1 text-xs text-destructive">{errors.message.message}</p>
      )}
    </form>
  );
}