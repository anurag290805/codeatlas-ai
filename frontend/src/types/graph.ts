// src/types/graph.ts

import type { Node, Edge } from "@xyflow/react";

import type { ID, Timestamp } from "./common";

/** Semantic kind of a code entity represented as a graph node. */
export type GraphNodeType =
  | "file"
  | "directory"
  | "module"
  | "class"
  | "function"
  | "interface";

/** Kind of relationship a graph edge represents between two code entities. */
export type DependencyType =
  | "imports"
  | "exports"
  | "extends"
  | "implements"
  | "calls"
  | "references";

/** Domain data carried by every dependency graph node, in addition to React Flow's layout fields. */
export interface GraphNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly filePath: string;
  readonly nodeType: GraphNodeType;
  readonly language: string;
  readonly importsCount: number;
  readonly exportsCount: number;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
  readonly lastModified: string;
}

/** A React Flow node specialized with CodeAtlas's dependency graph domain data. */
export type GraphNode = Node<GraphNodeData, GraphNodeType>;

/** A React Flow edge specialized with CodeAtlas's dependency relationship type. */
export type GraphEdge = Edge<Record<string, unknown>, DependencyType>;

/** Aggregate structural statistics computed over a repository's dependency graph. */
export interface GraphStatistics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly maxDepth: number;
  readonly averageDependenciesPerNode: number;
  readonly cyclicDependencyCount?: number;
  readonly isolatedNodeCount?: number;
}

/** Full dependency graph payload for a repository, as returned by the graph endpoint. */
export interface DependencyGraph {
  readonly repositoryId: ID;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly statistics: GraphStatistics;
  readonly generatedAt: Timestamp;
}