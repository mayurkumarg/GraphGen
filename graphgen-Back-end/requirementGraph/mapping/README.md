# Diagram mapping (planned)

**Status:** target contracts documented; no mapper, renderer, or controller connection is implemented or tested.

Input: a structurally valid `RequirementGraph` and requested diagram type. Output: versioned `DiagramProjection` IR with target type, source graph/version, diagram elements, relationships, provenance, and unsupported/ambiguous items. A projection is neither the semantic graph nor a rendered diagram. Mapping selects and translates supported concepts only; it must retain graph and requirement references and report omissions rather than fabricate details. Target folders specify supported types, transformation, ambiguity, and validation expectations: [ER](er/README.md), [UML](uml/README.md), [flowchart](flowchart/README.md), [automata](automata/README.md), [dataStructure](dataStructure/README.md). Failures use `PROJECTION_ERROR`. No mapping module calls existing controllers or renders output.
