# Shared utilities (planned)

**Status:** utility responsibilities documented; no utility implementations or tests are included.

Future shared helpers may provide unique prefixed ID generation and stable requirement ID management; node/edge lookup; directed graph traversal and relation lookup; normalized label comparison; provenance propagation; graph serialization/deserialization with version checks; and validation issue formatting. Helpers should be pure where practical, deterministic for equal inputs, and avoid changing semantic data. ID utilities must not silently reassign IDs during round trips. Serialization must preserve unknown compatible metadata or reject unsupported major schema versions explicitly. These utilities are internal to the future module and are not application utilities or imports.
