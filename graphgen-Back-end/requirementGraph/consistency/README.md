# Cross-diagram consistency (planned)

**Status:** comparison design documented; analyzer and reports are not implemented or tested.

Input: two or more diagram representations/projections with graph and provenance links. Output: `ConsistencyReport` with version, compared representations, conflicts, evidence, affected IDs, and status. Compare shared entities/concepts, labels, relation endpoints and direction, constraints, and represented states across views.

Equivalent views need not contain identical elements; only comparable claims are checked. Missing views are coverage gaps, not automatically contradictions. A conflict must cite the representations and source requirements involved. Ambiguous correspondence remains unresolved. Failures use `CONSISTENCY_ERROR`; results may be used by refinement but are not themselves corrections.
