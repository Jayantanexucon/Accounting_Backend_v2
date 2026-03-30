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

router.post("/", accessControlMiddleware({ entityKey: "Group", action: "CREATE" }), createGroup);

router.get("/", getAllGroups);

router.get("/:id", getGroupById);

router.put("/:id", accessControlMiddleware({ entityKey: "Group", action: "UPDATE" }), updateGroup);

router.delete("/:id", accessControlMiddleware({ entityKey: "Group", action: "DELETE" }), deleteGroup);

export default router;
