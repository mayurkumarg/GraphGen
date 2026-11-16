import { randomUUID } from "crypto";
import extractRequirements from "../services/requirementExtractor.js";
import extractRelationships from "../services/relationshipExtractor.js";
import buildGraph from "../services/graphBuilder.js";
import validateGraph from "../services/graphValidator.js";
import CustomError from "../../utils/customError.js";
import { verifyJwt } from "../../service/JWT.js";
import userModel from "../../models/userModel.js";
import { decrypt } from "../../utils/encryption.js";

const extractUserApiKey = async (req) => {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.split(" ")[1];
    if (!token) return null;

    const decoded = verifyJwt(token);
    if (!decoded?.id) return null;

    const user = await userModel.findById(decoded.id).select("geminiApiKey");
    if (user?.geminiApiKey?.iv && user?.geminiApiKey?.content && user?.geminiApiKey?.tag) {
      return decrypt(user.geminiApiKey);
    }
  } catch (err) {
    // Non-blocking fallback to env key
  }
  return null;
};

const normalizeGenerationRequest = (req) => {
  const payload = req.body || {};
  const requirement = typeof payload.requirement === "string" ? payload.requirement : "";
  const context = typeof payload.context === "string" ? payload.context : "";
  const category = typeof payload.category === "string" ? payload.category : "GENERAL";

  return { requirement, context, category };
};

const buildRequirementGraph = async (payload, apiKey = "") => {
  const { requirement, context, category } = payload;

  if (!requirement || !requirement.trim()) {
    throw new CustomError(400, "Requirement text is required.");
  }

  const extraction = await extractRequirements(requirement, context, category, apiKey);
  const graph = buildGraph({
    requirements: extraction.requirements,
    nodes: extraction.nodes,
    edges: extraction.edges || [],
    graphId: `RG_${randomUUID().slice(0, 8)}`,
  });

  graph.edges = extractRelationships(graph, extraction.edges || []);
  graph.metadata.nodeCount = graph.nodes.length;
  graph.metadata.edgeCount = graph.edges.length;

  return graph;
};

const generateRequirementGraph = async (req, res, next) => {
  try {
    const payload = normalizeGenerationRequest(req);
    const userApiKey = await extractUserApiKey(req);
    const graph = await buildRequirementGraph(payload, userApiKey);
    const validation = validateGraph(graph);

    res.status(200).json({
      status: "success",
      graph,
      validation,
    });
  } catch (error) {
    next(error);
  }
};

const validateRequirementGraph = async (req, res, next) => {
  try {
    const graph = req.body && typeof req.body === "object" ? req.body : null;

    if (!graph) {
      throw new CustomError(400, "A graph object is required for validation.");
    }

    const result = validateGraph(graph);
    res.status(200).json({
      status: "success",
      validation: result,
    });
  } catch (error) {
    next(error);
  }
};

const healthCheck = async (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Requirement Graph module is available.",
    module: "requirement-graph",
  });
};

export {
  generateRequirementGraph,
  validateRequirementGraph,
  healthCheck,
};
