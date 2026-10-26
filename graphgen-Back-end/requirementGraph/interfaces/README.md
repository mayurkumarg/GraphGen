# Conceptual interfaces (planned)

**Status:** contracts documented only; no classes, functions, stubs, or tests are provided. Each component consumes immutable/versioned values and returns a result plus evidence-bearing issues. Dependencies are explicit inputs; no module reaches into application globals.

| Contract | Input → output | Dependencies and failure cases |
| --- | --- | --- |
| `RequirementExtractor.extract(specification)` | source text/`SPEC-` identity → `ExtractionResult` with atomic source-linked requirements | No downstream dependency. `EXTRACTION_ERROR`; ambiguity and partial status retained. |
| `RequirementNormalizer.normalize(extractionResult)` | extraction result → normalized requirements and provenance | Extraction contract. `NORMALIZATION_ERROR`; uncertain matches reported, not silently merged. |
| `RequirementGraphBuilder.build(normalizedRequirements)` | normalized requirements → `RequirementGraph` | Node/edge vocabulary. `INVALID_GRAPH`, invalid references or unsupported types. |
| `RequirementGraphValidator.validate(requirementGraph)` | versioned graph → `GraphValidationReport` | Schema/type catalog. Structural and semantic issues; `VALIDATION_ERROR` for inability to evaluate. |
| `DiagramMapper.project(requirementGraph, diagramType)` | validated graph plus target profile → `DiagramProjection` | Graph and mapping profile. `PROJECTION_ERROR` for unsupported/ambiguous target mapping. |
| `DiagramValidator.validate(diagramProjection, generatedDiagram)` | projection plus parsed/generated representation → `ValidationReport` | Parser/representation adapter and requirement evidence. `VALIDATION_ERROR`; unsupported diagram syntax disclosed. |
| `TraceabilityManager.map(requirementGraph, diagramProjection)` | graph and projection (optionally output references) → `TraceabilityMapping` | Stable source IDs. `TRACEABILITY_ERROR` for unresolved links; missing coverage is a report state. |
| `ConsistencyAnalyzer.compare(diagramRepresentations)` | two or more versioned representations → `ConsistencyReport` | Correspondence/provenance. `CONSISTENCY_ERROR` if comparison cannot be made; ambiguity is retained. |
| `DiagramRefiner.refine(generatedDiagram, validationReport)` | representation and issues, plus iteration policy → `RefinementResult` with revised IR and `RefinementRecord` | Mapper/adapter and validator on each iteration. `REFINEMENT_LIMIT_REACHED`; no unbounded retry. |

All contracts are conceptual and language-independent. A future JS implementation may use async functions and discriminated result objects, but must define cancellation, limits, partial outcomes, and version compatibility before adoption. No fake implementations are included.
