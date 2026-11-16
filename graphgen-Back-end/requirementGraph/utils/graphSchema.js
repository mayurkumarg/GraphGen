export const NODE_TYPES = [
  "REQUIREMENT",
  "ACTOR",
  "ENTITY",
  "ACTION",
  "CONDITION",
  "CONSTRAINT",
  "EVENT",
  "STATE",
];

export const RELATIONSHIP_TYPES = [
  "PERFORMS",
  "CREATES",
  "USES",
  "DEPENDS_ON",
  "REQUIRES",
  "TRIGGERS",
  "PRECEDES",
  "ENABLES",
  "CONTAINS",
  "HAS_CONDITION",
  "HAS_STATE",
  "HAS_EVENT",
  "TRANSITIONS_TO",
  "CONSTRAINED_BY",
  "HAS_REQUIREMENT",
  "CONNECTS_TO",
  "INTERACTS_WITH",
  "ASSOCIATED_WITH",
  "INCLUDES",
  "EXTENDS",
  // Specific relationship types supported in requirements domain
  "ACTOR_PERFORMS_USE_CASE",
  "ACTOR_INTERACTS_WITH_SYSTEM",
  "USE_CASE_REQUIRES_AUTHENTICATION",
  "USE_CASE_USES_ENTITY",
  "ACTION_DEPENDS_ON_CONDITION",
  "ACTION_TRIGGERS_EVENT",
  "REQUIREMENT_SUPPORTED_BY",
  "REQUIREMENT_DEPENDS_ON",
];

export const DIAGRAM_CATEGORIES = {
  UML: "UML",
  AUTOMATA: "AUTOMATA",
  FLOWCHART: "FLOWCHART",
  ER: "ER",
  DATA_STRUCTURE: "DATA_STRUCTURE",
  GENERAL: "GENERAL",
};

export const DEFAULT_REQUIREMENT_CATEGORY = "GENERAL";

export const makeGraphSkeleton = ({ graphId, requirements = [] } = {}) => ({
  graphId: graphId || `RG_${Date.now().toString(36)}`,
  metadata: {
    createdAt: new Date().toISOString(),
    nodeCount: 0,
    edgeCount: 0,
  },
  requirements: Array.isArray(requirements) ? requirements : [],
  nodes: [],
  edges: [],
});

export const makeNode = ({
  id,
  type,
  name,
  description = "",
  sourceText = "",
  sourceRequirementId,
  confidence = 0.8,
  metadata = {},
}) => ({
  id,
  type,
  name,
  description,
  sourceText,
  sourceRequirementId,
  confidence,
  metadata,
});

export const makeEdge = ({
  id,
  source,
  target,
  type,
  label,
  sourceRequirementId,
  confidence = 0.8,
}) => ({
  id,
  source,
  target,
  type,
  label,
  sourceRequirementId,
  confidence,
});
