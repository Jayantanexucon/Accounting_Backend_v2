import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
} from "../controllers/groupController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "GROUPS", action: "CREATE" }), createGroup);

router.get("/", accessControlMiddleware({ entityKey: "GROUPS", action: "VIEW" }), getAllGroups);

router.get("/:id", accessControlMiddleware({ entityKey: "GROUPS", action: "VIEW" }), getGroupById);

router.put("/:id", accessControlMiddleware({ entityKey: "GROUPS", action: "EDIT" }), updateGroup);

router.delete("/:id", accessControlMiddleware({ entityKey: "GROUPS", action: "DELETE" }), deleteGroup);

export default router;
