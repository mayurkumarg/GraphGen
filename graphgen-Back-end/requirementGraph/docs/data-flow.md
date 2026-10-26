# Requirement Graph data flow

**Status:** intended flow documented; no pipeline stages are implemented or tested.

1. **Input specification:** source text plus stable `SPEC-` ID and source metadata.
2. **Extraction:** emits atomic candidate requirements with exact source text/spans, type, entities, actions, events, conditions, constraints, dependencies, uncertainty, and explicit/inferred distinction.
3. **Normalization:** canonicalizes terms where supported, separates compound obligations, assigns stable IDs, and preserves links to source requirements. Uncertain synonym matches remain flagged.
4. **Graph construction:** encodes supported concepts as typed nodes and evidence-backed directed edges; preserves provenance and does not invent relations.
5. **Graph validation:** checks unique IDs, node/edge types, endpoint references, graph references, and provenance; semantic concerns are reported distinctly.
6. **Diagram projection:** selects supported graph facts and maps them to target-specific IR (ER, UML, flowchart, automata, or data-structure profile). Ambiguities and omissions stay visible.
7. **Diagram generation:** a future adapter may pass IR to a generation engine, which produces the rendered artifact. The projection is the engine input representation; it is not the rendered diagram.
8. **Diagram parsing/extraction:** a future parser returns a structured representation of the artifact for checking; parser limitations are recorded.
9. **Requirement validation:** compares represented claims with requirements and checks required elements, relations, constraints, and conflicts.
10. **Traceability:** links requirement → graph elements → projection elements → parsed output references; identifies missing, partial, ambiguous, or unsupported coverage.
11. **Cross-diagram consistency:** compares related claims across multiple diagram representations and reports evidence-backed conflicts.
12. **Controlled refinement:** targets issues and affected IDs, revises an IR under an iteration limit, records attempts, and stops on criteria, non-progress, or limit.
13. **Revalidation/final output:** reruns relevant checks and returns the diagram plus validation, coverage, consistency, and refinement records.

The semantic graph is the common requirement model; each projection is a target view; the rendered diagram is a presentation artifact. They have separate IDs/versions and must not be conflated.
