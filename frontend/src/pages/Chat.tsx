import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Bot, Loader2, MessageSquare, Server } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { RepositorySelector } from "@/components/common/RepositorySelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRepositories } from "@/hooks/useRepositories";
import { useRepositoryQuery } from "@/hooks/useQuery";
import type { ChatMessage, Citation, QueryResponse } from "@/types";
import type { RepositoryListItem } from "@/types/repository";

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The repository query could not be completed. Please try again.";
}

function repositoryLabel(repository: RepositoryListItem): string {
  const name = repository.repository_name.trim();
  return name.replace(/^https:\/\/github\.com\//, "").replace(/\.git\/?$/, "");
}

function toCitation(citation: QueryResponse["citations"][number], index: number): Citation {
  return {
    id: `${citation.file_path}-${citation.start_line}-${index}`,
    filePath: citation.file_path,
    startLine: citation.start_line,
    endLine: citation.end_line,
    symbolName: citation.symbol_name ?? undefined,
    codePreview: citation.code_preview ?? undefined,
    relevanceScore: citation.relevance_score ?? undefined,
  };
}

function toAssistantMessage(response: QueryResponse): ChatMessage {
  return {
    id: messageId("assistant"),
    role: "assistant",
    content: response.answer,
    citations: response.citations.map(toCitation),
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

export function Chat() {
  const navigate = useNavigate();
  const { repositoryId: routeRepositoryId } = useParams<{ repositoryId: string }>();
  const [searchParams] = useSearchParams();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState(
    routeRepositoryId ?? searchParams.get("repositoryId") ?? "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const repositoriesQuery = useRepositories();
  const queryMutation = useRepositoryQuery();

  const repositories = useMemo(() => repositoriesQuery.data?.items ?? [], [repositoriesQuery.data]);
  const selectedRepository = useMemo(
    () => repositories.find((repository) => String(repository.id) === selectedRepositoryId),
    [repositories, selectedRepositoryId],
  );

  const handleRepositoryChange = (repositoryId: string) => {
    setSelectedRepositoryId(repositoryId);
    setMessages([]);
    if (repositoryId) {
      navigate(`/chat/${repositoryId}`);
    }
  };

  const handleSubmit = async (text: string) => {
    const numericRepositoryId = Number(selectedRepositoryId);
    if (!Number.isInteger(numericRepositoryId) || numericRepositoryId <= 0) {
      setMessages((current) => [
        ...current,
        {
          id: messageId("error"),
          role: "assistant",
          content: "Select an indexed repository before sending a question.",
          createdAt: new Date().toISOString(),
          status: "error",
        },
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: messageId("user"),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        status: "complete",
      },
    ]);

    try {
      const response = await queryMutation.mutateAsync({
        repository_id: numericRepositoryId,
        query: text,
        top_k: 3,
      });
      setMessages((current) => [...current, toAssistantMessage(response)]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId("error"),
          role: "assistant",
          content: formatError(error),
          createdAt: new Date().toISOString(),
          status: "error",
        },
      ]);
    }
  };

  const handleOpenCitation = (citation: Citation) => {
    if (!selectedRepositoryId) return;
    navigate(
      `/repositories/${selectedRepositoryId}?file=${encodeURIComponent(citation.filePath)}`,
    );
  };

  const queryError = repositoriesQuery.error;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl flex-col gap-5">
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-card to-cyan-500/5 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask grounded questions about an indexed repository.
            </p>
          </div>
        </div>
        <RepositorySelector
          repositories={repositories}
          value={selectedRepositoryId}
          onChange={handleRepositoryChange}
          isLoading={repositoriesQuery.isLoading}
        />
        </div>
      </div>

      {repositoriesQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading repositories…
        </div>
      )}

      {queryError && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Unable to load repositories. Try refreshing the page.
          </CardContent>
        </Card>
      )}

      {!repositoriesQuery.isLoading && !queryError && repositories.length === 0 && (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Server className="h-7 w-7 text-muted-foreground" />
            <p className="font-medium">No repositories are available</p>
            <p className="text-sm text-muted-foreground">
              Import a repository before starting a conversation.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedRepository && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-violet-500/20 shadow-[0_12px_50px_-30px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
          <CardHeader className="border-b border-violet-500/15 bg-violet-500/5 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              {repositoryLabel(selectedRepository)}
            </CardTitle>
          </CardHeader>
          <ChatWindow
            messages={messages}
            isLoading={queryMutation.isPending}
            disabled={queryMutation.isPending}
            onSubmit={handleSubmit}
            onSelectPrompt={(prompt) => void handleSubmit(prompt)}
            emptyStateRepositoryName={repositoryLabel(selectedRepository)}
            onOpenCitation={handleOpenCitation}
            className="min-h-[32rem] flex-1 border-0 bg-transparent shadow-none"
          />
        </Card>
      )}
    </div>
  );
}

export default Chat;
