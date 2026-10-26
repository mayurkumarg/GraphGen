# Automata projection (planned)

**Status:** projection contract documented; no transformation or tests exist.

Accept the common versioned Requirement Graph and a declared automaton profile (for example DFA or NFA). Project evidence-backed `STATE` nodes, initial and accepting states when specified, input symbols, and directed transitions into an automata `DiagramProjection`. Output records transition function representation and provenance for every state and transition.

Do not infer initial/accepting status or alphabet symbols. Report missing or conflicting state roles and unsupported conditions. Validate state references, unique symbols as required by the profile, transition endpoints, determinism for DFA, and explicit initial/accepting declarations. Cyclic transitions are valid. No automata runtime or renderer is included.
