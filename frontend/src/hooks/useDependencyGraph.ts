// src/hooks/useDependencyGraph.ts
import { useCallback, useEffect } from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { useGraph } from "@/hooks/useGraph";
import type { DependencyGraph, GraphEdge, GraphNode } from "@/types/graph";

/**
 * Manages client-side React Flow state — nodes, edges, and connection
 * handling — for the dependency graph visualization.
 *
 * This hook performs no data fetching. Graph data is retrieved
 * separately via `useGraph()` and passed in as `initialNodes` /
 * `initialEdges`.
 */
export function useDependencyGraph(repositoryId: string | undefined) {
  const graphQuery = useGraph(repositoryId);
  const graph = graphQuery.data as DependencyGraph | undefined;
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(graph?.nodes ? [...graph.nodes] : []);
    setEdges(graph?.edges ? [...graph.edges] : []);
  }, [graph, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((currentEdges) => addEdge(connection, currentEdges)),
    [setEdges],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    fitView,
    isLoading: graphQuery.isLoading,
    isError: graphQuery.isError,
    isEmpty: !graphQuery.isLoading && (graph?.nodes.length ?? 0) === 0,
  };
}
