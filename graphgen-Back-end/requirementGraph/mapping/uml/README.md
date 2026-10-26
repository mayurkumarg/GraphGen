# UML projection (planned)

**Status:** projection contract documented; no transformation or tests exist.

Accept the common versioned Requirement Graph and a declared UML diagram kind. Project supported actors, entities, actions, states, constraints, and directed relations into a UML-specific `DiagramProjection`. Potential elements include classes, attributes, operations, associations, inheritance, aggregation, composition, and dependencies; support varies by diagram kind. Output elements preserve graph and requirement IDs.

Do not infer inheritance, ownership, aggregation, or composition from mere co-occurrence. Report ambiguous semantics and unsupported node/edge types. Validate UML-kind compatibility, element IDs/types, association endpoints and direction, and provenance. This folder defines no renderer or controller integration.
