# Future integration plan

**Status:** proposal only. This module is not imported, routed, configured, or called by the application.

The eventual design keeps current direct generation available and makes Requirement Graph opt-in:

```text
Existing GraphGen Frontend → Existing Backend API → Optional Requirement Graph Layer
 → Diagram-Specific Projection → Adapter Interface → Existing Diagram Generation Engine
 → Existing Diagram Output
```

**Mode A — existing direct generation:** User Input → Existing Diagram Controller → Existing Generation Logic → Diagram Output.

**Mode B — optional graph generation:** User Input → Requirement Graph Pipeline → Diagram Projection → Adapter Interface → Existing Diagram Generation Engine → Diagram Output.

The adapter is a future boundary: accept a validated, versioned projection plus diagram target; map it to the exact input contract already accepted by the relevant generation engine; return the engine output with correlation and provenance references. It should be independently testable and reject incompatible projection versions or unsupported elements explicitly. It should not force graph types into controllers or replace the direct request path. Existing controllers could consume a projection only through this adapter in a separately reviewed future change, preserving their current direct-generation mode.

Before any future activation, define a feature-selection/API contract, input validation and size limits, error mapping, observability, privacy/provenance retention, compatibility policy, and rollback path. Then implement the pipeline and adapter in a separate change with tests. None of those actions is part of this architecture-only module; no endpoint, controller, environment variable, dependency, or application import is added here.
