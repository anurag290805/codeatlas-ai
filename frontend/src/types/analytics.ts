// src/types/analytics.ts

import type { ID, Timestamp } from "./common";

/** Share of a repository's files attributed to a single programming language. */
export interface LanguageDistributionItem {
  readonly language: string;
  readonly fileCount: number;
  readonly percentage: number;
}

/** Counts of AI-indexing chunks grouped by processing outcome. */
export interface ChunkStatistics {
  readonly totalChunks: number;
  readonly embeddedChunks: number;
  readonly pendingChunks: number;
  readonly failedChunks: number;
}

/** Byte-level breakdown of storage consumed by a repository's indexed data. */
export interface StorageBreakdown {
  readonly sourceFilesBytes: number;
  readonly embeddingsBytes: number;
  readonly metadataBytes: number;
  readonly graphDataBytes: number;
  readonly totalBytes: number;
}

/** Top-line repository analytics rendered by the summary metric cards. */
export interface RepositoryMetricsData {
  readonly totalFiles: number;
  readonly totalFolders: number;
  readonly linesOfCode: number;
  readonly languagesDetected: number;
  readonly aiChunks: number;
  readonly embeddings: number;
  readonly dependencyNodes: number;
  readonly repositorySizeBytes: number;
}

/** Number of commits recorded for a single point in time (typically a day). */
export interface CommitActivityDataPoint {
  readonly date: string;
  readonly commits: number;
}

/** Composed analytics payload for a repository's analytics dashboard. */
export interface AnalyticsSummary {
  readonly repositoryId: ID;
  readonly languageDistribution: readonly LanguageDistributionItem[];
  readonly chunkStatistics: ChunkStatistics;
  readonly storageBreakdown: StorageBreakdown;
  readonly metrics: RepositoryMetricsData;
  readonly commitActivity: readonly CommitActivityDataPoint[];
  readonly generatedAt: Timestamp;
}