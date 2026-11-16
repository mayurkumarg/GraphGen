import { makeGraphSkeleton } from "../utils/graphSchema.js";
import { makeUniqueId } from "../utils/graphHelpers.js";

const buildGraph = ({
  requirements = [],
  nodes = [],
  edges = [],
  graphId,
  metadata = {},
} = {}) => {
  const graph = makeGraphSkeleton({ graphId, requirements });

  if (metadata.createdAt) {
    graph.metadata.createdAt = metadata.createdAt;
  }

  const uniqueNodes = [];
  const seenNodeIds = new Set();

  nodes.forEach((node) => {
    if (!node?.id) return;
    if (seenNodeIds.has(node.id)) return;
    seenNodeIds.add(node.id);
    uniqueNodes.push(node);
  });

  const uniqueEdges = [];
  const seenEdgeIds = new Set();

  edges.forEach((edge) => {
    if (!edge?.id) {
      const generatedId = `EDGE_${makeUniqueId("REL")}`;
      edge.id = generatedId;
    }

    if (seenEdgeIds.has(edge.id)) return;
    seenEdgeIds.add(edge.id);
    uniqueEdges.push(edge);
  });

  graph.nodes = uniqueNodes;
  graph.edges = uniqueEdges;
  graph.metadata.nodeCount = graph.nodes.length;
  graph.metadata.edgeCount = graph.edges.length;

  return graph;
};

export default buildGraph;
