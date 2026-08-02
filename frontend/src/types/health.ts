// src/types/health.ts

import type { Timestamp } from "./common";

/** Overall health classification for the backend or one of its dependencies. */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/** Backend build/version metadata surfaced for diagnostics. */
export interface BackendVersion {
  readonly version: string;
  readonly commitSha?: string;
  readonly buildDate?: Timestamp;
}

/** Health of a single backend dependency (database, vector store, queue, etc.). */
export interface SystemHealth {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs?: number;
  readonly message?: string;
}

/** Payload returned by the backend's health-check endpoint. */
export interface HealthResponse {
  readonly status: HealthStatus;
  readonly version: BackendVersion;
  readonly uptimeSeconds: number;
  readonly checkedAt: Timestamp;
  readonly dependencies: readonly SystemHealth[];
}