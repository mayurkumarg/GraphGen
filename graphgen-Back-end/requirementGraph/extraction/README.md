# Extraction (planned)

**Status:** contract documented; extractor not implemented or tested.

Input: a specification with stable `SPEC-` ID and source text. Output: `ExtractionResult` containing source ID and atomic candidate requirements. Each requirement preserves exact source text, `REQ-` ID, type (`FUNCTIONAL`/`NON_FUNCTIONAL`), entities, actions, events, conditions, constraints, dependencies, source references, confidence (nullable), ambiguities, and explicit-versus-inferred provenance.

The future extractor identifies actors, entities, actions, events, conditions and constraints, retains original wording, and records uncertainty. It must not silently invent missing requirements or present inference as explicit fact. Downstream normalization receives evidence and ambiguity unchanged. Failure is reported as `EXTRACTION_ERROR` with source location/evidence where available; partial extraction must be marked as partial rather than silently treated as complete. The example contract is in the parent README and is illustrative only.
