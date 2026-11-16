import { Router } from "express";
import {
  generateRequirementGraph,
  validateRequirementGraph,
  healthCheck,
} from "../controllers/requirementGraphController.js";

const requirementGraphRoutes = Router();

requirementGraphRoutes.post("/generate", generateRequirementGraph);
requirementGraphRoutes.post("/validate", validateRequirementGraph);
requirementGraphRoutes.get("/health", healthCheck);

export default requirementGraphRoutes;
