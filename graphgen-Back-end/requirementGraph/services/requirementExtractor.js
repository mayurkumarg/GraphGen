import {
  DEFAULT_REQUIREMENT_CATEGORY,
  DIAGRAM_CATEGORIES,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  makeNode,
  makeEdge,
} from "../utils/graphSchema.js";
import { normalizeText, makeUniqueId } from "../utils/graphHelpers.js";
import analyzeRequirementWithAi from "./requirementAiService.js";

const safeId = (value, fallback) => {
  const normalized = normalizeText(value)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return normalized || fallback;
};

const normalizeRequirementRecord = (requirement, index, category, contextText) => {
  const text = typeof requirement?.text === "string" ? requirement.text.trim() : "";
  const sourceText = typeof requirement?.sourceText === "string" ? requirement.sourceText.trim() : text;
  const requirementText = text || sourceText || `Requirement ${index + 1}`;
  const id = safeId(requirement?.id || `REQ_${index + 1}`, `REQ_${index + 1}`);

  return {
    id,
    text: requirementText,
    category: normalizeText(requirement?.category) || category,
    context: normalizeText(requirement?.context) || contextText,
    sourceText: sourceText || requirementText,
    confidence: Number.isFinite(Number(requirement?.confidence)) ? Number(requirement.confidence) : 0.9,
  };
};

const dedupeById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || !item.id) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

/**
 * Builds domain-grounded nodes and relationships for fallback when AI is offline.
 */
const buildDomainFallbackGraph = (prompt, category = DEFAULT_REQUIREMENT_CATEGORY, context = "") => {
  const normalizedText = normalizeText(prompt);
  const normalizedCategory = normalizeText(category).toUpperCase() || DEFAULT_REQUIREMENT_CATEGORY;

  // Split prompt into meaningful requirement sentences
  const rawSentences = normalizedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const sentences = rawSentences.length > 0 ? rawSentences : [normalizedText];

  const requirements = sentences.map((sentence, idx) => ({
    id: `REQ_${idx + 1}`,
    text: sentence,
    category: normalizedCategory,
    context: context || "",
    sourceText: sentence,
    confidence: 0.9,
  }));

  const primaryReqId = requirements[0]?.id || "REQ_1";
  const nodes = [];
  const edges = [];

  // Always create requirement nodes
  requirements.forEach((req, idx) => {
    nodes.push(
      makeNode({
        id: req.id,
        type: "REQUIREMENT",
        name: `Requirement ${idx + 1}`,
        description: req.text,
        sourceText: req.sourceText,
        sourceRequirementId: req.id,
        confidence: 0.95,
      })
    );
  });

  const addEdge = (source, target, type, label, reqId = primaryReqId) => {
    if (!source || !target || source === target) return;
    edges.push(
      makeEdge({
        id: `EDGE_${makeUniqueId("REL")}`,
        source,
        target,
        type,
        label,
        sourceRequirementId: reqId,
        confidence: 0.88,
      })
    );
  };

  const lowerText = normalizedText.toLowerCase();

  // Category: AUTOMATA (DFA / NFA)
  if (normalizedCategory.includes("AUTOMATA") || normalizedCategory.includes("DFA") || normalizedCategory.includes("NFA")) {
    const states = ["q0", "q1", "q2", "q_accept"];
    states.forEach((s, idx) => {
      const isStart = idx === 0;
      const isAccept = idx === states.length - 1;
      nodes.push(
        makeNode({
          id: `ST_${s.toUpperCase()}`,
          type: "STATE",
          name: isStart ? `Start State (${s})` : isAccept ? `Accept State (${s})` : `State (${s})`,
          description: isStart ? "Initial state of the automaton" : isAccept ? "Accepting final state" : `Intermediate state ${s}`,
          sourceText: prompt,
          sourceRequirementId: primaryReqId,
          confidence: 0.9,
        })
      );
    });

    const alphabetNode = makeNode({
      id: "ENT_ALPHABET",
      type: "ENTITY",
      name: "Input Alphabet",
      description: "Symbols processed by the automaton (e.g. 0, 1, a, b)",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.9,
    });
    nodes.push(alphabetNode);

    const acceptCondition = makeNode({
      id: "COND_ACCEPTANCE",
      type: "CONDITION",
      name: "Acceptance Condition",
      description: "Automaton accepts string upon reaching the accepting state",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.88,
    });
    nodes.push(acceptCondition);

    // Edges
    addEdge(primaryReqId, "ST_Q0", "CONTAINS", "specifies initial state");
    addEdge(primaryReqId, alphabetNode.id, "CONTAINS", "defines alphabet");
    addEdge("ST_Q0", "ST_Q1", "TRANSITIONS_TO", "transitions on input");
    addEdge("ST_Q1", "ST_Q2", "TRANSITIONS_TO", "transitions on input");
    addEdge("ST_Q2", "ST_Q_ACCEPT", "TRANSITIONS_TO", "transitions to accept state");
    addEdge("ST_Q_ACCEPT", acceptCondition.id, "REQUIRES", "satisfies acceptance condition");
    addEdge(alphabetNode.id, "ST_Q0", "USES", "supplies input tokens");
  }
  // Category: FLOWCHART
  else if (normalizedCategory.includes("FLOWCHART") || lowerText.includes("flowchart")) {
    const startEvent = makeNode({
      id: "EVT_START",
      type: "EVENT",
      name: "Start Process",
      description: "Trigger that initiates the flowchart workflow",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.92,
    });
    const step1 = makeNode({
      id: "ACTN_RECEIVE_INPUT",
      type: "ACTION",
      name: "Receive Input / Request",
      description: "Initial action to collect and parse workflow inputs",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.88,
    });
    const decision = makeNode({
      id: "COND_VALIDATION_DECISION",
      type: "CONDITION",
      name: "Validation Decision",
      description: "Branch condition evaluating whether input meets requirements",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.9,
    });
    const step2 = makeNode({
      id: "ACTN_EXECUTE_PROCESS",
      type: "ACTION",
      name: "Execute Main Process",
      description: "Primary operational step executed when validation succeeds",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.88,
    });
    const endEvent = makeNode({
      id: "EVT_END",
      type: "EVENT",
      name: "End Process",
      description: "Terminal event concluding the workflow execution",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.92,
    });

    nodes.push(startEvent, step1, decision, step2, endEvent);

    addEdge(primaryReqId, startEvent.id, "CONTAINS", "initiates process");
    addEdge(startEvent.id, step1.id, "TRIGGERS", "triggers input reception");
    addEdge(step1.id, decision.id, "PRECEDES", "evaluates decision condition");
    addEdge(decision.id, step2.id, "ENABLES", "enables process execution if valid");
    addEdge(step2.id, endEvent.id, "TRIGGERS", "completes at end process");
  }
  // Category: ER DIAGRAM
  else if (normalizedCategory.includes("ER") || lowerText.includes("entity") || lowerText.includes("database")) {
    const primaryEntityName = lowerText.includes("bank") ? "Account" : lowerText.includes("commerce") || lowerText.includes("order") ? "Order" : "MainEntity";
    const userEntityName = lowerText.includes("customer") ? "Customer" : "User";

    const userEntity = makeNode({
      id: `ENT_${userEntityName.toUpperCase()}`,
      type: "ENTITY",
      name: userEntityName,
      description: `${userEntityName} entity with identifier and profile attributes`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.92,
    });
    const mainEntity = makeNode({
      id: `ENT_${primaryEntityName.toUpperCase()}`,
      type: "ENTITY",
      name: primaryEntityName,
      description: `${primaryEntityName} entity managed within the data model`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.9,
    });
    const detailEntity = makeNode({
      id: "ENT_TRANSACTION",
      type: "ENTITY",
      name: lowerText.includes("bank") ? "Transaction Record" : "Item Detail",
      description: "Related transactional or detail entity",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.88,
    });
    const pkConstraint = makeNode({
      id: "CSTR_PRIMARY_KEY",
      type: "CONSTRAINT",
      name: "Primary Key & Foreign Key Constraints",
      description: "Enforces unique entity identification and referential integrity",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.89,
    });

    nodes.push(userEntity, mainEntity, detailEntity, pkConstraint);

    addEdge(primaryReqId, userEntity.id, "CONTAINS", "defines entity");
    addEdge(primaryReqId, mainEntity.id, "CONTAINS", "defines entity");
    addEdge(userEntity.id, mainEntity.id, "ASSOCIATED_WITH", "holds or manages");
    addEdge(mainEntity.id, detailEntity.id, "CONNECTS_TO", "has related records");
    addEdge(mainEntity.id, pkConstraint.id, "CONSTRAINED_BY", "constrained by relational keys");
  }
  // Category: DATA STRUCTURE
  else if (normalizedCategory.includes("DATA_STRUCTURE") || normalizedCategory.includes("DS") || lowerText.includes("tree") || lowerText.includes("list") || lowerText.includes("graph")) {
    const dsName = lowerText.includes("tree") ? "Binary Tree" : lowerText.includes("graph") ? "Graph" : lowerText.includes("queue") ? "Queue" : lowerText.includes("stack") ? "Stack" : "Data Structure";

    const rootNode = makeNode({
      id: "ENT_ROOT_NODE",
      type: "ENTITY",
      name: `Root / Head (${dsName})`,
      description: `Primary entry point for the ${dsName}`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.93,
    });
    const childNode = makeNode({
      id: "ENT_ELEMENT_NODE",
      type: "ENTITY",
      name: "Element / Child Node",
      description: "Internal element holding payload data and pointers",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.9,
    });
    const opInsert = makeNode({
      id: "ACTN_INSERT",
      type: "ACTION",
      name: "Insert Operation",
      description: `Adds a new node or value into the ${dsName}`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.91,
    });
    const opTraverse = makeNode({
      id: "ACTN_TRAVERSE_SEARCH",
      type: "ACTION",
      name: "Search / Traverse Operation",
      description: `Locates elements by navigating pointer references`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.9,
    });

    nodes.push(rootNode, childNode, opInsert, opTraverse);

    addEdge(primaryReqId, rootNode.id, "CONTAINS", "defines data structure entry");
    addEdge(rootNode.id, childNode.id, "CONNECTS_TO", "references connected node");
    addEdge(opInsert.id, childNode.id, "CREATES", "creates new node reference");
    addEdge(opTraverse.id, rootNode.id, "USES", "begins traversal from root");
  }
  // Category: UML (and Default Domain)
  else {
    const isBanking = lowerText.includes("bank");
    const systemName = isBanking ? "Online Banking System" : "Target Software System";

    const systemEntity = makeNode({
      id: "ENT_SYSTEM",
      type: "ENTITY",
      name: systemName,
      description: `Central software system boundary for ${systemName}`,
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.95,
    });

    const customerActor = makeNode({
      id: "ACT_CUSTOMER",
      type: "ACTOR",
      name: isBanking ? "Customer" : "Primary User",
      description: isBanking ? "End user who interacts with online banking services" : "Standard system user",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.94,
    });

    const adminActor = makeNode({
      id: "ACT_ADMIN",
      type: "ACTOR",
      name: isBanking ? "Bank Administrator" : "Administrator",
      description: "Privileged actor managing accounts, configuration, and monitoring",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.92,
    });

    nodes.push(systemEntity, customerActor, adminActor);

    // Standard actions for banking or general UML
    const actionDefs = isBanking
      ? [
          { id: "ACTN_REGISTER", name: "Register", desc: "Allows new customers to create an account", actor: "ACT_CUSTOMER" },
          { id: "ACTN_LOGIN", name: "Log In", desc: "Authenticates users into the online banking system", actor: "ACT_CUSTOMER" },
          { id: "ACTN_VIEW_BALANCE", name: "View Account Balance", desc: "Displays current and available account funds", actor: "ACT_CUSTOMER" },
          { id: "ACTN_TRANSFER_FUNDS", name: "Transfer Funds", desc: "Moves funds between accounts with balance verification", actor: "ACT_CUSTOMER" },
          { id: "ACTN_TRANSACTION_HISTORY", name: "View Transaction History", desc: "Provides statement and past transactions record", actor: "ACT_CUSTOMER" },
          { id: "ACTN_PAY_BILLS", name: "Pay Bills", desc: "Dispatches bill payments to external payees", actor: "ACT_CUSTOMER" },
          { id: "ACTN_MANAGE_ACCOUNTS", name: "Manage Customer Accounts", desc: "Enables administrative account updates and lifecycle management", actor: "ACT_ADMIN" },
          { id: "ACTN_MONITOR_TRANSACTIONS", name: "Monitor Transactions", desc: "Administrative oversight for transaction verification and fraud monitoring", actor: "ACT_ADMIN" },
        ]
      : [
          { id: "ACTN_AUTHENTICATE", name: "Authenticate", desc: "Verifies user identity", actor: "ACT_CUSTOMER" },
          { id: "ACTN_USE_SERVICE", name: "Access Primary Service", desc: "Executes the main functional use case", actor: "ACT_CUSTOMER" },
          { id: "ACTN_MANAGE_SYSTEM", name: "Manage System Settings", desc: "Configures and oversees system behavior", actor: "ACT_ADMIN" },
        ];

    actionDefs.forEach((act) => {
      const actNode = makeNode({
        id: act.id,
        type: "ACTION",
        name: act.name,
        description: act.desc,
        sourceText: prompt,
        sourceRequirementId: primaryReqId,
        confidence: 0.9,
      });
      nodes.push(actNode);
      addEdge(act.actor, act.id, "PERFORMS", `${act.actor === "ACT_CUSTOMER" ? "Customer" : "Administrator"} performs ${act.name}`);
      addEdge(act.id, systemEntity.id, "USES", `operates on ${systemName}`);
    });

    // Conditions and Constraints
    const authCondition = makeNode({
      id: "COND_AUTH",
      type: "CONDITION",
      name: "Authentication Verified",
      description: "Prerequisite security state required before accessing protected functions",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.92,
    });

    const balanceConstraint = makeNode({
      id: "CSTR_BALANCE_VALIDATION",
      type: "CONSTRAINT",
      name: "Account Balance Validation",
      description: "Fund transfers require available balance >= transfer amount before processing",
      sourceText: prompt,
      sourceRequirementId: primaryReqId,
      confidence: 0.94,
    });

    nodes.push(authCondition, balanceConstraint);

    // Link Requirement to primary elements
    addEdge(primaryReqId, systemEntity.id, "CONTAINS", "specifies system boundary");
    addEdge(primaryReqId, customerActor.id, "CONTAINS", "specifies customer actor");
    addEdge(primaryReqId, adminActor.id, "CONTAINS", "specifies administrator actor");

    // Link conditions & constraints
    if (isBanking) {
      addEdge("ACTN_TRANSFER_FUNDS", balanceConstraint.id, "CONSTRAINED_BY", "requires balance validation");
      addEdge("ACTN_VIEW_BALANCE", authCondition.id, "REQUIRES", "requires authenticated session");
      addEdge("ACTN_TRANSFER_FUNDS", authCondition.id, "REQUIRES", "requires authenticated session");
      addEdge("ACTN_MANAGE_ACCOUNTS", authCondition.id, "REQUIRES", "requires admin authentication");
    } else {
      addEdge("ACTN_USE_SERVICE", authCondition.id, "REQUIRES", "requires authenticated session");
    }

    addEdge(customerActor.id, systemEntity.id, "INTERACTS_WITH", "interacts with system interface");
    addEdge(adminActor.id, systemEntity.id, "INTERACTS_WITH", "interacts with management interface");
  }

  // Connect multiple requirement nodes sequentially if present
  if (requirements.length > 1) {
    for (let i = 0; i < requirements.length - 1; i += 1) {
      addEdge(
        requirements[i].id,
        requirements[i + 1].id,
        "DEPENDS_ON",
        `${requirements[i].name || requirements[i].id} relates to ${requirements[i + 1].name || requirements[i + 1].id}`,
        requirements[i].id
      );
    }
  }

  return {
    requirements,
    nodes: dedupeById(nodes),
    edges,
    category: normalizedCategory,
    context,
    sourcePrompt: normalizedText,
  };
};

const extractRequirements = async (
  prompt,
  context = "",
  category = DEFAULT_REQUIREMENT_CATEGORY,
  apiKey = ""
) => {
  const requirementText = normalizeText(prompt);
  const contextText = normalizeText(context);
  const normalizedCategory = normalizeText(category) || DEFAULT_REQUIREMENT_CATEGORY;

  if (!requirementText) {
    throw new Error("Requirement text is required.");
  }

  // Attempt AI extraction with configured Gemini models
  const aiResult = await analyzeRequirementWithAi({
    requirement: requirementText,
    context: contextText,
    category: normalizedCategory,
    apiKey,
  });

  if (
    aiResult &&
    Array.isArray(aiResult.requirements) &&
    aiResult.requirements.length > 0 &&
    Array.isArray(aiResult.nodes) &&
    aiResult.nodes.length > 0
  ) {
    const rawRequirements = aiResult.requirements.map((req, idx) =>
      normalizeRequirementRecord(req, idx, aiResult.category || normalizedCategory, aiResult.context || contextText)
    );

    const validRequirementIds = new Set(rawRequirements.map((r) => r.id));

    // Ensure every requirement has a corresponding REQUIREMENT node
    const requirementNodes = rawRequirements.map((req, idx) =>
      makeNode({
        id: req.id,
        type: "REQUIREMENT",
        name: `Requirement ${idx + 1}`,
        description: req.text,
        sourceText: req.sourceText,
        sourceRequirementId: req.id,
        confidence: req.confidence || 0.92,
      })
    );

    // Sanitize AI-provided nodes
    const validAiNodes = aiResult.nodes
      .filter((n) => n && n.id && n.name)
      .map((n) => {
        const type = NODE_TYPES.includes(n.type?.toUpperCase()) ? n.type.toUpperCase() : "ENTITY";
        const reqId = validRequirementIds.has(n.sourceRequirementId)
          ? n.sourceRequirementId
          : rawRequirements[0]?.id || "REQ_1";

        return makeNode({
          id: safeId(n.id, `NODE_${makeUniqueId("ND")}`),
          type,
          name: typeof n.name === "string" ? n.name : String(n.id),
          description: typeof n.description === "string" ? n.description : "",
          sourceText: requirementText,
          sourceRequirementId: reqId,
          confidence: Number.isFinite(Number(n.confidence)) ? Number(n.confidence) : 0.88,
        });
      });

    const allNodes = dedupeById([...requirementNodes, ...validAiNodes]);
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Build ID & Name resolution map for robust edge endpoint matching
    const idResolver = new Map();
    allNodes.forEach((node) => {
      idResolver.set(node.id, node.id);
      idResolver.set(node.id.toLowerCase(), node.id);
      idResolver.set(safeId(node.id), node.id);
      if (node.name) {
        idResolver.set(node.name, node.id);
        idResolver.set(node.name.toLowerCase(), node.id);
        idResolver.set(safeId(node.name), node.id);
      }
    });

    const resolveId = (ref) => {
      if (!ref) return null;
      const str = String(ref).trim();
      return (
        idResolver.get(str) ||
        idResolver.get(str.toLowerCase()) ||
        idResolver.get(safeId(str)) ||
        null
      );
    };

    // Sanitize AI-provided edges using the resolver
    const rawEdges = Array.isArray(aiResult.edges) ? aiResult.edges : [];
    const validAiEdges = rawEdges
      .map((e) => {
        if (!e) return null;
        const resolvedSource = resolveId(e.source);
        const resolvedTarget = resolveId(e.target);
        if (!resolvedSource || !resolvedTarget || resolvedSource === resolvedTarget) return null;

        const type = RELATIONSHIP_TYPES.includes(e.type) ? e.type : "USES";
        return makeEdge({
          id: e.id || `EDGE_${makeUniqueId("REL")}`,
          source: resolvedSource,
          target: resolvedTarget,
          type,
          label: e.label || type.toLowerCase().replace(/_/g, " "),
          sourceRequirementId: nodeMap.get(resolvedSource)?.sourceRequirementId || rawRequirements[0]?.id || "REQ_1",
          confidence: Number.isFinite(Number(e.confidence)) ? Number(e.confidence) : 0.85,
        });
      })
      .filter(Boolean);

    // Ensure REQUIREMENT nodes are linked to primary nodes if AI forgot to connect them
    const connectedSources = new Set(validAiEdges.map((e) => e.source));
    const connectedTargets = new Set(validAiEdges.map((e) => e.target));
    const nonReqNodes = allNodes.filter((n) => n.type !== "REQUIREMENT");

    rawRequirements.forEach((req) => {
      const isConnected = connectedSources.has(req.id) || connectedTargets.has(req.id);
      if (!isConnected && nonReqNodes.length > 0) {
        // Link to matching nodes or the first few non-requirement nodes
        const matchingChildren = nonReqNodes.filter((n) => n.sourceRequirementId === req.id);
        const targets = matchingChildren.length > 0 ? matchingChildren.slice(0, 3) : nonReqNodes.slice(0, 2);

        targets.forEach((targetNode) => {
          validAiEdges.push(
            makeEdge({
              id: `EDGE_${makeUniqueId("REL")}`,
              source: req.id,
              target: targetNode.id,
              type: "CONTAINS",
              label: `contains ${targetNode.name}`,
              sourceRequirementId: req.id,
              confidence: 0.9,
            })
          );
        });
      }
    });

    return {
      requirements: rawRequirements,
      nodes: allNodes,
      edges: validAiEdges,
      category: aiResult.category || normalizedCategory,
      context: aiResult.context || contextText,
      sourcePrompt: aiResult.sourcePrompt || requirementText,
    };
  }

  // Fallback to domain-grounded extraction
  return buildDomainFallbackGraph(requirementText, normalizedCategory, contextText);
};

export default extractRequirements;
