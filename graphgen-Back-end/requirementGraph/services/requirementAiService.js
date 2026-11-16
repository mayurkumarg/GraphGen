import { GoogleGenAI } from "@google/genai";
import { DEFAULT_REQUIREMENT_CATEGORY, NODE_TYPES, RELATIONSHIP_TYPES } from "../utils/graphSchema.js";

const getApiKey = (passedKey) =>
  passedKey || process.env.REQUIREMENT_GRAPH_GEMINI_API || process.env.GEMINI_API || "";

const parseModelJson = (text = "") => {
  const cleaned = String(text).trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[1] || match[0]);
    } catch (secondError) {
      return null;
    }
  }
};

const SYSTEM_INSTRUCTION = `You are an expert systems engineer and requirements analyst.
Your task is to analyze a software requirement prompt for a specific diagram category and extract a fully structured, grounded Requirement Graph.

Schema specification:
1. "requirements": array of requirement objects:
   [
     {
       "id": "REQ_1",
       "text": "Detailed statement of the requirement",
       "sourceText": "Original prompt excerpt"
     }
   ]

2. "nodes": array of graph nodes. Every requirement MUST have a corresponding REQUIREMENT node with id matching the requirement id (e.g. "REQ_1").
   Allowed node types: ${JSON.stringify(NODE_TYPES)}
   Each node must have:
   {
     "id": "A unique uppercase identifier (e.g., REQ_1, ACT_CUSTOMER, ENT_ONLINE_BANKING, ACTN_TRANSFER_FUNDS, COND_AUTH_VALID, CSTR_BALANCE_CHECK)",
     "type": "One of: REQUIREMENT, ACTOR, ENTITY, ACTION, CONDITION, CONSTRAINT, EVENT, STATE",
     "name": "Readable human title (e.g. Customer, Transfer Funds, Sufficient Balance)",
     "description": "Clear 1-sentence description of this element",
     "sourceRequirementId": "Matching requirement ID (e.g., REQ_1)",
     "confidence": 0.9
   }

3. "edges": array of directed relationship edges between nodes:
   Allowed relationship types include: ${JSON.stringify(RELATIONSHIP_TYPES)}
   Each edge must have:
   {
     "id": "EDGE_1",
     "source": "Existing node id",
     "target": "Existing node id",
     "type": "Relationship type from allowed list (e.g., CONTAINS, PERFORMS, USES, REQUIRES, DEPENDS_ON, CONSTRAINED_BY, TRIGGERS, TRANSITIONS_TO)",
     "label": "Readable label explaining the relationship",
     "sourceRequirementId": "Matching requirement ID (e.g., REQ_1)"
   }

CRITICAL RULES:
- Every REQUIREMENT node MUST be connected to its main actors/entities/actions using "CONTAINS" or "REQUIRES" edges. NEVER leave a REQUIREMENT node isolated!
- All edge sources and targets MUST exist in the "nodes" list. No dangling references.
- NO self-referencing edges (source !== target).
- NO duplicate edges.
- Ground the elements in the diagram category:
  * UML: Extract actors, system boundary, use cases (as ACTION), entity objects, conditions/constraints (authentication, validation).
  * AUTOMATA (DFA/NFA): Extract states (STATE), input symbols/alphabet (ENTITY), transitions (TRANSITIONS_TO), acceptance conditions (CONDITION/CONSTRAINT).
  * FLOWCHART: Extract start/end (EVENT), process actions (ACTION), decision conditions (CONDITION), and sequence flows (PRECEDES, TRIGGERS).
  * ER: Extract entities (ENTITY), attributes (ENTITY), primary keys/constraints (CONSTRAINT), and relationships (ASSOCIATED_WITH, CONNECTS_TO).
  * DATA STRUCTURE: Extract elements/nodes (ENTITY), references/pointers (CONNECTS_TO, USES), and operations (ACTION).

Return valid JSON ONLY with root keys: "requirements", "nodes", "edges", "category", "context".`;

const analyzeRequirementWithAi = async ({
  requirement,
  context = "",
  category = DEFAULT_REQUIREMENT_CATEGORY,
  apiKey: explicitKey = "",
} = {}) => {
  const apiKey = getApiKey(explicitKey);

  if (!apiKey) {
    console.warn("[RequirementAiService] No Gemini API key available; using domain heuristic extractor.");
    return null;
  }

  const primaryModel = process.env.REQUIREMENT_GRAPH_MODEL || "gemini-3.5-flash-lite";
  const fallbackModel = "gemini-3.8-flash";
  const candidateModels = [primaryModel, fallbackModel].filter(
    (model, index, self) => self.indexOf(model) === index
  );

  const client = new GoogleGenAI({ apiKey });
  const userPrompt = `Diagram Category: ${category}\nContext: ${context || "None"}\nRequirement Prompt: ${requirement}`;

  for (const model of candidateModels) {
    let timer;
    try {
      const generatePromise = client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      // Prevent unhandled rejection if timeout wins the race
      generatePromise.catch(() => {});

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI model ${model} request timed out after 8s`)), 8000);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      const text =
        response?.text ||
        response?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ||
        "";

      const payload = parseModelJson(text);

      if (
        payload &&
        Array.isArray(payload.requirements) &&
        payload.requirements.length > 0 &&
        Array.isArray(payload.nodes) &&
        payload.nodes.length > 0
      ) {
        return {
          ...payload,
          category: payload.category || category || DEFAULT_REQUIREMENT_CATEGORY,
          context: payload.context || context || "",
          sourcePrompt: requirement,
        };
      }
    } catch (error) {
      console.warn(`[RequirementAiService] Model ${model} generation failed:`, error.message);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return null;
};

export default analyzeRequirementWithAi;
