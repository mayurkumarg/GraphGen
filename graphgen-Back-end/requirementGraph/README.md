# Requirement Graph (design only)

## Introduction and motivation

Requirement Graph is an isolated architectural preparation area for a future pipeline that turns software specifications into traceable, diagram-specific representations. It provides a shared semantic model so separate diagram views can be checked against the same requirements. Ambiguity remains visible; the architecture does not authorize inventing requirements.

## Objectives and status

Objectives are modular processing boundaries, stable provenance, typed graph semantics, consistent projections, validation, traceability, and an optional future adapter to GraphGen. **This directory contains documentation and empty mapping extension points only.** No extraction, normalization, graph building, validation, mapping, generation, API, integration, or tests are implemented. Nothing here is imported by the running application. Status terms in this module: *documented* means a design contract is described; *planned* means future behavior; *implemented* means executable behavior exists; *tested* means such behavior has been exercised. The pipeline is documented/planned; its processing is not implemented or tested.

## Model overview

The proposed model is a directed typed property graph `G = (V, E)`, represented with ordinary JavaScript-compatible objects: `nodes[]`, `edges[]`, and `metadata`. A graph is distinct from a diagram projection (a target-specific intermediate representation), which is distinct from the eventual rendered diagram. No graph database or graph library is assumed.

| Node type | Meaning |
| --- | --- |
| `REQUIREMENT` | Atomic functional or non-functional obligation |
| `ACTOR` | External user or system actor |
| `ENTITY` | Domain object |
| `ACTION` | Operation or activity |
| `EVENT` | Occurrence or trigger |
| `CONDITION` | Conditional expression |
| `CONSTRAINT` | Business rule or restriction |
| `STATE` | System or object state |
| `DIAGRAM_ELEMENT` | Element projected to a diagram |

| Edge type | Meaning |
| --- | --- |
| `HAS_ENTITY` | Requirement references an entity |
| `PERFORMS` | Actor performs an action |
| `AFFECTS` | Action affects an entity |
| `TRIGGERS` | Event triggers an action |
| `DEPENDS_ON` | Requirement depends on another requirement |
| `REQUIRES` | Requirement requires a condition |
| `CONSTRAINED_BY` | Element is restricted by a constraint |
| `TRANSITIONS_TO` | State changes to another state |
| `RELATED_TO` | Explicitly supported general semantic relation |
| `PROJECTS_TO` | Graph element maps to a diagram element |

Every node and edge has a unique prefixed ID (`NODE-`, `EDGE-`), type, and provenance (`sourceRequirementIds`). Nodes also have a label, optional description and attributes, and metadata including origin (`EXTRACTED`, `NORMALIZED`, `INFERRED`, `MANUALLY_CORRECTED`) and optional confidence. Edges have `source`, `target`, type, provenance, `directed: true`, and metadata. A graph has `graphId` (`RG-`), `version`, `sourceSpecificationId` (`SPEC-`), nodes, edges, and metadata including creation time, counts, and design/processing status. IDs should remain stable across stages when identity is retained.

Structural invariants: IDs are unique in their respective collections; edge endpoints exist; node and edge types are enumerated; graph references and provenance are valid; semantically directional relationships remain directed; normalized identity plus context informs duplicate detection; cycles are permitted unless a specific rule disallows them; unsupported edges are never fabricated; extracted facts remain distinguishable from inference.

## Conceptual data contracts

These examples define shape only; they are not produced by code.

```json
{
  "sourceSpecificationId": "SPEC-001",
  "requirements": [{
    "id": "REQ-001", "text": "A customer can place an order.",
    "type": "FUNCTIONAL", "sourceText": "A customer can place an order.",
    "confidence": null, "entities": ["Customer", "Order"],
    "actions": ["place"], "conditions": [], "constraints": [], "ambiguities": []
  }]
}
```

An extracted requirement retains exact source text, type (`FUNCTIONAL` or `NON_FUNCTIONAL`), entities, actions, conditions, constraints, ambiguities, and confidence (nullable). Normalized requirements carry `requirementId`, `sourceRequirementId`, `normalizedText`, `requirementType`, entities, actions, conditions, constraints, dependencies, and provenance. Normalization is deterministic where possible, preserves original references and meaningful distinctions, and records uncertain synonym matches rather than merging them.

```json
{
  "graphId": "RG-001", "version": "1.0", "sourceSpecificationId": "SPEC-001",
  "nodes": [], "edges": [],
  "metadata": {"createdAt": null, "nodeCount": 0, "edgeCount": 0, "status": "DESIGN_ONLY"}
}
```

## Directory structure and responsibilities

| Area | Responsibility and contract |
| --- | --- |
| `extraction/` | Specification to atomic source-linked requirements; preserves ambiguity and explicit/inferred distinction. |
| `normalization/` | Extraction result to stable, normalized requirements with source links and uncertainty. |
| `graph/` | Normalized requirements to the typed graph while enforcing graph construction rules. |
| `mapping/` | Graph to diagram-specific intermediate projection; never renders diagrams. |
| `validation/` | Structural, semantic, projection, and requirement coverage checks with evidence-bearing issues. |
| `traceability/` | Requirement-to-graph-to-projection-to-output links and coverage/gap reporting. |
| `consistency/` | Compare diagram representations for shared concept/relationship conflicts. |
| `refinement/` | Bounded, issue-targeted correction cycle and attempt records. |
| `schemas/` | JSON Schema-compatible conceptual contracts; no database models. |
| `interfaces/` | Language-neutral future component inputs, outputs, dependencies, and failures. |
| `utils/` | Future shared IDs, lookups, traversal, comparison, provenance, serialization, issue formatting. |
| `docs/` | Architecture, end-to-end flow, and integration proposal. |

Submodule contracts: [extraction](extraction/README.md), [normalization](normalization/README.md), [graph](graph/README.md), [mapping](mapping/README.md), [validation](validation/README.md), [traceability](traceability/README.md), [consistency](consistency/README.md), [refinement](refinement/README.md), [schemas](schemas/README.md), [interfaces](interfaces/README.md), and [utilities](utils/README.md). Diagram mapping contracts: [ER](mapping/er/README.md), [UML](mapping/uml/README.md), [flowchart](mapping/flowchart/README.md), [automata](mapping/automata/README.md), [data structures](mapping/dataStructure/README.md).

## Processing pipeline

```text
Specification → Extraction → Atomic requirements → Normalization → Typed graph
 → Graph validation → Diagram projection → Diagram generation → Diagram parsing/extraction
 → Requirement validation → Traceability → Cross-diagram consistency
 → Bounded refinement → Revalidation → Final output
```

The specification enters extraction with source identity. Extraction emits evidence-linked candidate facts and uncertainty. Normalization stabilizes terms and atomicity while retaining source links. Graph construction encodes supported facts/relations as typed nodes and directed edges. Graph validation checks invariants before mapping. A mapper selects graph content and creates a target-specific intermediate representation (IR). A future generation engine consumes that IR and produces a rendered diagram; parsing/extraction converts that artifact back to a representation for comparison. Requirement validation checks the representation against obligations. Traceability connects each obligation through graph and diagram elements. Consistency checks shared concepts across diagram representations. Refinement uses reported issues and affected IDs to revise the IR, then revalidates. Final output includes artifact and reports. The graph is semantic source data; the projection is a target dialect; rendered output is presentation.

## Validation, traceability, consistency, and refinement

Graph validation checks unique node/edge IDs, valid endpoints and references, allowed types, and required provenance. Projection validation checks required/missing, unsupported, duplicate, mislabeled, or mistyped elements and incorrect/misdirected/missing relations. Requirement validation checks coverage, conflicts, constraints, conditions, and semantic correspondence. Issues should include stable issue ID, category, severity, message, affected requirement/node/edge/diagram IDs, evidence, and suggested correction where justified. Reports carry graph/projection versions and status; a passing structural check does not imply semantic correctness.

Trace records (IDs prefixed `TRACE-`) link requirement ID, graph element IDs, projection element IDs, output element references, coverage status, evidence, and provenance. Coverage should distinguish covered, partial, missing, ambiguous, and unsupported; no unsupported inference should count as coverage. Consistency compares corresponding concepts, labels, relationships, constraints, and direction across diagram types and reports conflicts with source evidence. Refinement records (`REF-`) include iteration, affected requirement IDs, issues, corrections, and status. Refinement must have a configurable maximum iteration count, detect non-progress/repeated states, and stop on satisfied criteria or limit; reaching the limit yields `REFINEMENT_LIMIT_REACHED`.

## Interfaces and errors

Future conceptual interfaces: `RequirementExtractor.extract(specification) → ExtractionResult`; `RequirementNormalizer.normalize(extractionResult) → NormalizationResult`; `RequirementGraphBuilder.build(normalizedRequirements) → RequirementGraph`; `RequirementGraphValidator.validate(requirementGraph) → GraphValidationReport`; `DiagramMapper.project(requirementGraph, diagramType) → DiagramProjection`; `DiagramValidator.validate(diagramProjection, generatedDiagram) → ValidationReport`; `TraceabilityManager.map(requirementGraph, diagramProjection) → TraceabilityMapping`; `ConsistencyAnalyzer.compare(diagramRepresentations) → ConsistencyReport`; `DiagramRefiner.refine(generatedDiagram, validationReport) → RefinementResult`. Full inputs, outputs, dependencies, and failure cases are specified in [interfaces](interfaces/README.md). These are proposals, not executable classes.

Conceptual error codes: `EXTRACTION_ERROR`, `NORMALIZATION_ERROR`, `INVALID_GRAPH`, `INVALID_EDGE_REFERENCE`, `UNSUPPORTED_NODE_TYPE`, `UNSUPPORTED_EDGE_TYPE`, `PROJECTION_ERROR`, `VALIDATION_ERROR`, `TRACEABILITY_ERROR`, `CONSISTENCY_ERROR`, `REFINEMENT_LIMIT_REACHED`. Errors should identify stage and relevant stable IDs while retaining the original evidence. No active error handlers or endpoints are provided.

## Schemas and versioning

The schema catalog covers Requirement, NormalizedRequirement, RequirementNode, RequirementEdge, RequirementGraph, DiagramProjection, DiagramElement, ValidationIssue, ValidationReport, TraceabilityMapping, ConsistencyReport, and RefinementRecord. Field requirements and relationships are documented in [schemas](schemas/README.md). Graph, requirement schema, projection, and validation report each have independent versions. Consumers declare supported versions; additive optional fields may be introduced compatibly, while breaking changes require a new major schema version and explicit migration/adapter. Never silently reinterpret persisted older data.

## Integration boundary

Requirement Graph is an optional future layer. Existing direct generation remains independent. A future adapter could translate a validated diagram projection into the input expected by an existing generation engine. It must be designed separately and reviewed before application wiring; this task adds no import, route, controller, environment setting, or dependency. See [integration plan](docs/integration-plan.md).

## Verification and implementation status

The module structure and design documentation are the only deliverables here. No processing implementation or test suite exists, and no claim of runtime graph generation is made. Verification for this preparation task is limited to checking the required directory/document inventory and confirming changes remain within `requirementGraph/`; starting the app or invoking endpoints is outside this documentation-only change.
