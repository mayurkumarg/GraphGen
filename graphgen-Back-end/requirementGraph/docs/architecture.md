# Requirement Graph architecture

**Status:** architecture design documented; all processing behavior is planned, not implemented or tested.

## Boundaries and ownership

The proposed pipeline separates extraction, normalization, semantic graph construction, graph validation, target mapping, diagram generation, output parsing, requirement validation, traceability, consistency, and bounded refinement. Each stage owns its output contract and receives explicit versioned input. Extraction owns source spans and candidate facts; normalization owns canonical terms and source links; graph owns typed semantic nodes/edges; mapping owns target-specific IR; a future existing generation engine owns rendering; validators own findings, not corrections. Traceability owns links across these representations.

The common graph uses `nodes[]`, `edges[]`, and metadata, with `NODE-`/`EDGE-` identifiers and source requirement references. Node and edge vocabularies are listed in the module README. Relations have explicit direction. The graph may contain cycles; validity comes from type/reference/provenance rules, not acyclicity. A diagram projection is a separate target-specific structure; rendered output is a later artifact.

## Dependency direction

Conceptual dependencies flow forward: extraction → normalization → graph → graph validation → mapping → optional adapter/generation → parse → requirement validation → traceability/consistency → bounded refinement → revalidation. Shared schemas and vocabulary are referenced by stages; utilities do not own business decisions. Mapping does not call controllers or render. Validation reports evidence and does not mutate inputs. Refinement consumes reports and re-enters validation with a limit.

## Extensibility and versioning

New target profiles can add mapping rules without changing the common graph. Schema versions are explicit for graph, requirements, projection, and reports. Additive optional fields can be compatible; semantic/breaking changes require a new major version and explicit adapters. Unknown types are reported or rejected according to declared compatibility, never silently reinterpreted. Provenance distinguishes `EXTRACTED`, `NORMALIZED`, `INFERRED`, and `MANUALLY_CORRECTED` origins. No graph database is required.
