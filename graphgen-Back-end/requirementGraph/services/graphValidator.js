import { NODE_TYPES, RELATIONSHIP_TYPES } from "../utils/graphSchema.js";

const validateGraph = (graph) => {
  const errors = [];
  const warnings = [];
  const structuralErrors = [];
  const structuralWarnings = [];
  const semanticWarnings = [];
  const stats = {
    totalNodes: 0,
    totalEdges: 0,
    isolatedNodes: 0,
    unmappedRequirements: 0,
  };

  if (!graph || typeof graph !== "object") {
    return {
      isValid: false,
      errors: ["Graph payload is missing or invalid."],
      warnings: [],
      structuralValidation: { errors: ["Graph payload is missing or invalid."], warnings: [] },
      semanticValidation: { warnings: [], errors: [] },
      statistics: stats,
    };
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const requirements = Array.isArray(graph.requirements) ? graph.requirements : [];

  const nodeIds = new Set();
  const edgeIds = new Set();

  nodes.forEach((node) => {
    if (!node || typeof node !== "object") {
      structuralErrors.push("Encountered an invalid node entry.");
      return;
    }

    stats.totalNodes += 1;

    if (!node.id) structuralErrors.push(`Node is missing id: ${JSON.stringify(node)}`);
    if (node.id && nodeIds.has(node.id)) structuralErrors.push(`Duplicate node id detected: ${node.id}`);
    if (node.id) nodeIds.add(node.id);

    if (!node.type || !NODE_TYPES.includes(node.type)) {
      structuralErrors.push(`Node has invalid type: ${node.type || "undefined"}`);
    }

    if (!node.name || typeof node.name !== "string") {
      structuralErrors.push(`Node is missing valid name: ${node.id || "unknown"}`);
    }

    if (!node.sourceRequirementId && node.type !== "REQUIREMENT") {
      structuralWarnings.push(`Node ${node.id || "unknown"} is missing sourceRequirementId.`);
    }

    if (node.type === "REQUIREMENT") {
      const requirementMatch = requirements.some((req) => req && req.id === node.id);
      if (!requirementMatch) {
        semanticWarnings.push(`Requirement node ${node.id} has no matching requirement record.`);
      }
    }
  });

  const seenEdgeRelationships = new Set();
  edges.forEach((edge) => {
    if (!edge || typeof edge !== "object") {
      structuralErrors.push("Encountered an invalid edge entry.");
      return;
    }

    stats.totalEdges += 1;

    if (!edge.id) structuralErrors.push(`Edge is missing id: ${JSON.stringify(edge)}`);
    if (edge.id && edgeIds.has(edge.id)) structuralErrors.push(`Duplicate edge id detected: ${edge.id}`);
    if (edge.id) edgeIds.add(edge.id);

    if (edge.source && edge.target && edge.type) {
      const relKey = `${edge.source}->${edge.target}:${edge.type}`;
      if (seenEdgeRelationships.has(relKey)) {
        structuralWarnings.push(`Duplicate relationship detected between ${edge.source} and ${edge.target} (${edge.type}).`);
      } else {
        seenEdgeRelationships.add(relKey);
      }
    }

    if (!edge.type || !RELATIONSHIP_TYPES.includes(edge.type)) {
      structuralErrors.push(`Edge has invalid relationship type: ${edge.type || "undefined"}`);
    }

    if (!edge.source || !edge.target) {
      structuralErrors.push(`Edge ${edge.id || "unknown"} is missing source or target.`);
    }

    if (edge.source && !nodeIds.has(edge.source)) {
      structuralErrors.push(`Edge ${edge.id || "unknown"} references unknown source node: ${edge.source}`);
    }

    if (edge.target && !nodeIds.has(edge.target)) {
      structuralErrors.push(`Edge ${edge.id || "unknown"} references unknown target node: ${edge.target}`);
    }

    if (edge.source === edge.target) {
      structuralWarnings.push(`Edge ${edge.id || "unknown"} points to itself (self-loop detected).`);
    }

    if (!edge.label || typeof edge.label !== "string") {
      structuralWarnings.push(`Edge ${edge.id || "unknown"} is missing a human-readable label.`);
    }
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const connectedNodeIds = new Set();

  edges.forEach((edge) => {
    if (edge && edge.source && nodeMap.has(edge.source)) connectedNodeIds.add(edge.source);
    if (edge && edge.target && nodeMap.has(edge.target)) connectedNodeIds.add(edge.target);
  });

  nodes.forEach((node) => {
    if (node && node.id && !connectedNodeIds.has(node.id)) {
      stats.isolatedNodes += 1;
      semanticWarnings.push(`Node ${node.id} (${node.name || node.type}) is isolated and has no incident edges.`);
    }
  });

  requirements.forEach((req) => {
    if (!req || !req.id) {
      structuralErrors.push("Requirement entry is missing required id.");
      return;
    }

    const mapped = nodes.some((node) => {
      if (!node) return false;
      return node.id === req.id || node.sourceRequirementId === req.id;
    });

    if (!mapped) {
      stats.unmappedRequirements += 1;
      semanticWarnings.push(`Requirement ${req.id} is not mapped to any requirement or child node.`);
    }
  });

  const supportedPairs = {
    PERFORMS: [["ACTOR", "ACTION"], ["ACTOR", "ENTITY"]],
    ACTOR_PERFORMS_USE_CASE: [["ACTOR", "ACTION"], ["ACTOR", "ENTITY"]],
    CREATES: [["ACTOR", "ENTITY"], ["ACTION", "ENTITY"]],
    USES: [["ACTOR", "ENTITY"], ["ACTION", "ENTITY"], ["ACTOR", "ACTION"], ["ENTITY", "ENTITY"], ["ENTITY", "STATE"], ["STATE", "ENTITY"]],
    USE_CASE_USES_ENTITY: [["ACTION", "ENTITY"], ["ACTOR", "ENTITY"]],
    DEPENDS_ON: [["REQUIREMENT", "REQUIREMENT"], ["ACTION", "ACTION"], ["ACTION", "CONDITION"], ["ENTITY", "ENTITY"]],
    REQUIREMENT_DEPENDS_ON: [["REQUIREMENT", "REQUIREMENT"], ["REQUIREMENT", "ENTITY"]],
    REQUIRES: [["REQUIREMENT", "CONDITION"], ["REQUIREMENT", "ACTION"], ["REQUIREMENT", "ENTITY"], ["ACTION", "CONDITION"], ["ACTION", "ACTION"], ["STATE", "CONDITION"]],
    USE_CASE_REQUIRES_AUTHENTICATION: [["ACTION", "CONDITION"], ["ACTION", "ACTION"], ["ACTOR", "CONDITION"]],
    TRIGGERS: [["EVENT", "ACTION"], ["ACTION", "EVENT"], ["ACTION", "ACTION"]],
    ACTION_TRIGGERS_EVENT: [["ACTION", "EVENT"], ["ACTION", "ACTION"]],
    PRECEDES: [["ACTION", "ACTION"], ["EVENT", "ACTION"], ["ACTION", "CONDITION"], ["CONDITION", "ACTION"]],
    ENABLES: [["ACTION", "ACTION"], ["CONDITION", "ACTION"]],
    CONTAINS: [
      ["REQUIREMENT", "ENTITY"],
      ["REQUIREMENT", "ACTOR"],
      ["REQUIREMENT", "ACTION"],
      ["REQUIREMENT", "CONDITION"],
      ["REQUIREMENT", "CONSTRAINT"],
      ["REQUIREMENT", "STATE"],
      ["REQUIREMENT", "EVENT"],
      ["ENTITY", "ENTITY"],
      ["ENTITY", "ACTION"],
      ["ENTITY", "ACTOR"],
    ],
    HAS_CONDITION: [["REQUIREMENT", "CONDITION"], ["ACTION", "CONDITION"]],
    ACTION_DEPENDS_ON_CONDITION: [["ACTION", "CONDITION"], ["REQUIREMENT", "CONDITION"]],
    HAS_STATE: [["REQUIREMENT", "STATE"], ["ENTITY", "STATE"], ["ACTION", "STATE"]],
    HAS_EVENT: [["REQUIREMENT", "EVENT"], ["ACTION", "EVENT"]],
    TRANSITIONS_TO: [["STATE", "STATE"], ["ACTION", "ACTION"]],
    CONSTRAINED_BY: [["REQUIREMENT", "CONSTRAINT"], ["ACTION", "CONSTRAINT"], ["ENTITY", "CONSTRAINT"]],
    HAS_REQUIREMENT: [["REQUIREMENT", "REQUIREMENT"]],
    REQUIREMENT_SUPPORTED_BY: [["REQUIREMENT", "ACTION"], ["REQUIREMENT", "ENTITY"], ["REQUIREMENT", "ACTOR"]],
    CONNECTS_TO: [["ENTITY", "ENTITY"], ["ACTION", "ACTION"], ["STATE", "STATE"]],
    INTERACTS_WITH: [["ACTOR", "ENTITY"], ["ACTOR", "ACTOR"], ["ENTITY", "ENTITY"]],
    ACTOR_INTERACTS_WITH_SYSTEM: [["ACTOR", "ENTITY"]],
    ASSOCIATED_WITH: [["ENTITY", "ENTITY"], ["ACTOR", "ENTITY"], ["ACTION", "ENTITY"]],
    INCLUDES: [["ACTION", "ACTION"], ["REQUIREMENT", "REQUIREMENT"]],
    EXTENDS: [["ACTION", "ACTION"], ["REQUIREMENT", "REQUIREMENT"]],
  };

  edges.forEach((edge) => {
    if (!edge || !edge.type || !edge.source || !edge.target) return;
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) return;

    const allowedList = supportedPairs[edge.type];
    if (allowedList) {
      const isAllowed = allowedList.some(
        ([srcType, tgtType]) => srcType === sourceNode.type && tgtType === targetNode.type
      );
      if (!isAllowed) {
        semanticWarnings.push(
          `Relationship ${edge.type} from ${sourceNode.type} (${sourceNode.name}) to ${targetNode.type} (${targetNode.name}) is semantically non-standard.`
        );
      }
    }
  });

  const structuralValidation = { errors: structuralErrors, warnings: structuralWarnings };
  const semanticValidation = { errors: [], warnings: semanticWarnings };
  const allErrors = [...structuralErrors];
  const allWarnings = [...structuralWarnings, ...semanticWarnings];
  const isValid = allErrors.length === 0 && stats.isolatedNodes === 0 && stats.unmappedRequirements === 0;

  return {
    isValid,
    errors: allErrors,
    warnings: allWarnings,
    structuralValidation,
    semanticValidation,
    statistics: stats,
  };
};

export default validateGraph;
