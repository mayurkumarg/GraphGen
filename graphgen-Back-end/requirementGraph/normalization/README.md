# Normalization (planned)

**Status:** contract documented; normalization is not implemented or tested.

Input: an `ExtractionResult`. Output: normalized atomic requirements with `requirementId`, `sourceRequirementId`, `normalizedText`, `requirementType`, `entities`, `actions`, `conditions`, `constraints`, `dependencies`, and provenance. Preserve exact source linkage and distinctions between similar concepts. Normalize terms deterministically where evidence supports it; record uncertain synonym candidates and never merge them silently. Split compound statements only when each resulting obligation remains traceable to source spans/IDs. Stable IDs should survive reruns when semantic identity is unchanged. Failures use `NORMALIZATION_ERROR` with affected source IDs and evidence. Output feeds the graph builder; no extraction or graph-building behavior is implemented here.
