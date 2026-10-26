# Validation (planned)

**Status:** categories and issue contract documented; validators and results are not implemented or tested.

Graph structural checks: unique node/edge IDs, valid edge endpoints and graph references, supported types, required provenance. Diagram checks: missing required or unsupported elements, duplicates, labels and element types. Relationship checks: correct source/target, direction/type, and required relation presence. Requirement checks: coverage, conflicts, constraints/conditions, and consistency with evidence.

Conceptual `ValidationIssue`: stable ID, code/category, severity, message, affected requirement/node/edge/diagram IDs, evidence, and optional justified correction. `ValidationReport` carries report/schema version, subject graph/projection versions, issues, and status. Structural validity does not establish semantic correctness. Failures use `VALIDATION_ERROR`; an issue is evidence, not a fabricated validation result. Validation feeds traceability and bounded refinement.
