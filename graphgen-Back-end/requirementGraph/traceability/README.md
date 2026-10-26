# Traceability (planned)

**Status:** mapping design documented; trace generation is not implemented or tested.

Input: graph, projection, and where available parsed output references. Output: `TraceabilityMapping` containing `TRACE-` records that link requirement IDs to graph node/edge IDs, projection element IDs, output references, evidence, and coverage status. Status values distinguish `COVERED`, `PARTIAL`, `MISSING`, `AMBIGUOUS`, and `UNSUPPORTED`.

Preserve provenance end-to-end; distinguish direct, normalized, inferred, and manually corrected facts. Report requirements without diagram coverage and diagram elements without requirement support. Do not count unsupported inference as coverage. Failures use `TRACEABILITY_ERROR` and identify affected IDs. Traceability reports explain coverage; they do not rewrite requirements.
