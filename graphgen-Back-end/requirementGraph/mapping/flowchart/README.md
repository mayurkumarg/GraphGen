# Flowchart projection (planned)

**Status:** projection contract documented; no transformation or tests exist.

Accept the common versioned Requirement Graph. Project evidenced actions/events/conditions into start/end, process, decision, and input/output elements plus directed control-flow edges and conditional branches. Exception paths may be represented only when stated or explicitly supported by source evidence. Output is a flowchart-specific `DiagramProjection` with provenance links.

Do not invent ordering, branches, termination, or exception behavior to make a chart appear complete. Report missing start/end or unresolved sequence as issues when required by the chosen profile. Validate element kinds, edge endpoints/direction, branch condition labels, reachability rules where required, and source traceability.
