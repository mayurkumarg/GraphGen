# ER projection (planned)

**Status:** projection contract documented; no transformation or tests exist.

Accept the common versioned Requirement Graph. Project supported `ENTITY` nodes and evidence-backed attributes, primary/foreign keys, and relationships from supported `HAS_ENTITY`, `AFFECTS`, and explicit relation evidence. Output an ER `DiagramProjection` containing entity, attribute, key, relationship, cardinality, and participation elements, each retaining graph and requirement IDs.

Do not infer keys, cardinality, or participation without evidence. Unsupported concepts and ambiguous relation endpoints are reported with provenance. Validate unique element IDs, entity/key references, endpoint existence, cardinality/participation domain, and traceability. Unsupported or underspecified constraints remain explicit issues, not invented ER facts.
