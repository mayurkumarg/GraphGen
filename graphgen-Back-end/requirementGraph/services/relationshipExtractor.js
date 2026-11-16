import { RELATIONSHIP_TYPES, makeEdge } from "../utils/graphSchema.js";
import { makeUniqueId } from "../utils/graphHelpers.js";

const extractRelationships = (graphData = {}, initialEdges = []) => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  const seenEdges = new Set();

  // ID and Name resolver for robust matching
  const idResolver = new Map();
  nodes.forEach((node) => {
    idResolver.set(node.id, node.id);
    idResolver.set(node.id.toLowerCase(), node.id);
    if (node.name) {
      idResolver.set(node.name, node.id);
      idResolver.set(node.name.toLowerCase(), node.id);
    }
  });

  const resolveId = (ref) => {
    if (!ref) return null;
    const str = String(ref).trim();
    return idResolver.get(str) || idResolver.get(str.toLowerCase()) || null;
  };

  const addEdge = (source, target, type, label, sourceRequirementId, confidence = 0.85) => {
    const sId = resolveId(source);
    const tId = resolveId(target);
    if (!sId || !tId || sId === tId) return;
    if (!nodeMap.has(sId) || !nodeMap.has(tId)) return;

    // Use canonical type if supported
    const resolvedType = RELATIONSHIP_TYPES.includes(type) ? type : "USES";
    const key = `${sId}->${tId}:${resolvedType}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);

    edges.push(
      makeEdge({
        id: `EDGE_${makeUniqueId("REL")}`,
        source: sId,
        target: tId,
        type: resolvedType,
        label: label || resolvedType.toLowerCase().replace(/_/g, " "),
        sourceRequirementId: sourceRequirementId || nodeMap.get(sId)?.sourceRequirementId,
        confidence,
      })
    );
  };

  // 1. Ingest valid initial edges (from AI or domain extraction)
  const candidateInitial = [
    ...(Array.isArray(initialEdges) ? initialEdges : []),
    ...(Array.isArray(graphData.edges) ? graphData.edges : []),
  ];

  candidateInitial.forEach((edge) => {
    if (!edge) return;
    const sId = resolveId(edge.source);
    const tId = resolveId(edge.target);
    if (!sId || !tId || sId === tId) return;
    if (!nodeMap.has(sId) || !nodeMap.has(tId)) return;

    addEdge(
      sId,
      tId,
      edge.type,
      edge.label,
      edge.sourceRequirementId,
      edge.confidence || 0.88
    );
  });

  // Group nodes by type
  const actorNodes = nodes.filter((node) => node.type === "ACTOR");
  const actionNodes = nodes.filter((node) => node.type === "ACTION");
  const entityNodes = nodes.filter((node) => node.type === "ENTITY");
  const conditionNodes = nodes.filter((node) => node.type === "CONDITION");
  const constraintNodes = nodes.filter((node) => node.type === "CONSTRAINT");
  const requirementNodes = nodes.filter((node) => node.type === "REQUIREMENT");
  const stateNodes = nodes.filter((node) => node.type === "STATE");
  const eventNodes = nodes.filter((node) => node.type === "EVENT");

  // Helper: check which nodes are connected
  const getConnectedNodeIds = () => {
    const connected = new Set();
    edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    return connected;
  };

  // 2. Ensure every REQUIREMENT node has at least one incident edge
  requirementNodes.forEach((reqNode, idx) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(reqNode.id)) {
      // Connect to system or first entity, or first actor
      const targetEntity =
        entityNodes.find((e) => e.sourceRequirementId === reqNode.id) ||
        entityNodes[0] ||
        actorNodes.find((a) => a.sourceRequirementId === reqNode.id) ||
        actorNodes[0] ||
        actionNodes[0];

      if (targetEntity) {
        addEdge(
          reqNode.id,
          targetEntity.id,
          "CONTAINS",
          `specifies ${targetEntity.name}`,
          reqNode.id,
          0.92
        );
      }
    }

    // Connect sequential requirements
    if (idx < requirementNodes.length - 1) {
      const nextReq = requirementNodes[idx + 1];
      addEdge(
        reqNode.id,
        nextReq.id,
        "DEPENDS_ON",
        `${reqNode.name} relates to ${nextReq.name}`,
        reqNode.id,
        0.8
      );
    }
  });

  // 3. Connect condition and constraint nodes to requirements or actions
  conditionNodes.forEach((condNode) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(condNode.id)) {
      const targetAction =
        actionNodes.find((a) => a.sourceRequirementId === condNode.sourceRequirementId) ||
        actionNodes[0];
      const targetReq =
        requirementNodes.find((r) => r.id === condNode.sourceRequirementId) ||
        requirementNodes[0];

      if (targetAction) {
        addEdge(
          targetAction.id,
          condNode.id,
          "REQUIRES",
          `requires ${condNode.name}`,
          condNode.sourceRequirementId,
          0.85
        );
      } else if (targetReq) {
        addEdge(
          targetReq.id,
          condNode.id,
          "HAS_CONDITION",
          `has condition ${condNode.name}`,
          condNode.sourceRequirementId,
          0.85
        );
      }
    }
  });

  constraintNodes.forEach((cstrNode) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(cstrNode.id)) {
      const targetAction =
        actionNodes.find((a) => a.sourceRequirementId === cstrNode.sourceRequirementId) ||
        actionNodes[0];
      const targetReq =
        requirementNodes.find((r) => r.id === cstrNode.sourceRequirementId) ||
        requirementNodes[0];

      if (targetAction) {
        addEdge(
          targetAction.id,
          cstrNode.id,
          "CONSTRAINED_BY",
          `constrained by ${cstrNode.name}`,
          cstrNode.sourceRequirementId,
          0.88
        );
      } else if (targetReq) {
        addEdge(
          targetReq.id,
          cstrNode.id,
          "CONSTRAINED_BY",
          `constrained by ${cstrNode.name}`,
          cstrNode.sourceRequirementId,
          0.88
        );
      }
    }
  });

  // 4. Connect actors to actions if not already connected
  actorNodes.forEach((actor) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(actor.id) && actionNodes.length > 0) {
      const targetAction =
        actionNodes.find((a) => a.sourceRequirementId === actor.sourceRequirementId) ||
        actionNodes[0];
      if (targetAction) {
        addEdge(
          actor.id,
          targetAction.id,
          "PERFORMS",
          `${actor.name} performs ${targetAction.name}`,
          actor.sourceRequirementId,
          0.88
        );
      }
    }
  });

  // 5. Connect actions to system/entities if not already connected
  actionNodes.forEach((action) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(action.id)) {
      const targetEntity =
        entityNodes.find((e) => e.sourceRequirementId === action.sourceRequirementId) ||
        entityNodes[0];
      const targetActor =
        actorNodes.find((a) => a.sourceRequirementId === action.sourceRequirementId) ||
        actorNodes[0];

      if (targetActor) {
        addEdge(
          targetActor.id,
          action.id,
          "PERFORMS",
          `${targetActor.name} performs ${action.name}`,
          action.sourceRequirementId,
          0.85
        );
      } else if (targetEntity) {
        addEdge(
          action.id,
          targetEntity.id,
          "USES",
          `operates on ${targetEntity.name}`,
          action.sourceRequirementId,
          0.85
        );
      }
    }
  });

  // 6. Connect states sequentially if isolated
  if (stateNodes.length > 1) {
    for (let i = 0; i < stateNodes.length - 1; i += 1) {
      const current = stateNodes[i];
      const next = stateNodes[i + 1];
      const connected = getConnectedNodeIds();
      if (!connected.has(current.id) || !connected.has(next.id)) {
        addEdge(
          current.id,
          next.id,
          "TRANSITIONS_TO",
          `${current.name} transitions to ${next.name}`,
          current.sourceRequirementId,
          0.82
        );
      }
    }
  }

  // 7. Connect events
  eventNodes.forEach((evt) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(evt.id) && actionNodes.length > 0) {
      addEdge(
        evt.id,
        actionNodes[0].id,
        "TRIGGERS",
        `${evt.name} triggers ${actionNodes[0].name}`,
        evt.sourceRequirementId,
        0.85
      );
    }
  });

  // 8. Connect any remaining isolated entity nodes to parent requirement
  entityNodes.forEach((entity) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(entity.id)) {
      const parentReq =
        requirementNodes.find((r) => r.id === entity.sourceRequirementId) ||
        requirementNodes[0];
      if (parentReq) {
        addEdge(
          parentReq.id,
          entity.id,
          "CONTAINS",
          `defines ${entity.name}`,
          parentReq.id,
          0.88
        );
      }
    }
  });

  // 9. Connect any remaining isolated actor nodes to parent requirement
  actorNodes.forEach((actor) => {
    const connected = getConnectedNodeIds();
    if (!connected.has(actor.id)) {
      const parentReq =
        requirementNodes.find((r) => r.id === actor.sourceRequirementId) ||
        requirementNodes[0];
      if (parentReq) {
        addEdge(
          parentReq.id,
          actor.id,
          "CONTAINS",
          `specifies ${actor.name}`,
          parentReq.id,
          0.88
        );
      }
    }
  });

  return edges;
};

export default extractRelationships;
