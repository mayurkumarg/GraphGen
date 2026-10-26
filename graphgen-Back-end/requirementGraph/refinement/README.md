# Refinement (planned)

**Status:** bounded workflow documented; no correction algorithm or LLM integration is implemented or tested.

Input: generated representation and validation report. Planned steps: identify affected requirements/elements; construct targeted corrections; revise intermediate representation; validate again; record each attempt. A `RefinementRecord` uses `REF-` ID and includes iteration, affected requirement IDs, issues, corrections, status (`PENDING`, `APPLIED`, `REJECTED`, `SATISFIED`, `LIMIT_REACHED`), and provenance.

Use a configured maximum iteration count, stop when criteria pass, and detect repeated/non-progressing output. At the limit return `REFINEMENT_LIMIT_REACHED`; never loop indefinitely. Preserve original issues and each revision for audit. No correction is asserted as successful without a subsequent validation pass.
