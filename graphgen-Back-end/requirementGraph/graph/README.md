# Requirement graph (planned)

**Status:** graph semantics documented; builder and storage are not implemented or tested.

Input: normalized requirements. Output: a versioned graph object with `graphId`, `version`, `sourceSpecificationId`, `nodes[]`, `edges[]`, and metadata. Nodes are typed `REQUIREMENT`, `ACTOR`, `ENTITY`, `ACTION`, `EVENT`, `CONDITION`, `CONSTRAINT`, `STATE`, or `DIAGRAM_ELEMENT`; edges are directed typed `HAS_ENTITY`, `PERFORMS`, `AFFECTS`, `TRIGGERS`, `DEPENDS_ON`, `REQUIRES`, `CONSTRAINED_BY`, `TRANSITIONS_TO`, `RELATED_TO`, or `PROJECTS_TO`.

IDs use `NODE-` and `EDGE-`; provenance records source requirement IDs and origin. Reject duplicate IDs, dangling endpoints, unsupported types, and invalid provenance. Detect likely duplicate semantic nodes using normalized identity plus context without collapsing distinct concepts. Cycles are not inherently invalid. Never create unsupported relations or blur extracted facts and inference. Failures include `INVALID_GRAPH`, `INVALID_EDGE_REFERENCE`, `UNSUPPORTED_NODE_TYPE`, or `UNSUPPORTED_EDGE_TYPE`. Use plain JS-compatible arrays/objects; no graph database/library is part of this design.
