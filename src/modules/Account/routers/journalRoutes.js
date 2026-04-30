import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createJournal,
  getAllJournals,
  getJournalById,
  updateJournal,
  deleteJournal,
  getJournalStats,
  approveJournal,
  rejectJournal,
  getPendingApprovals,
} from "../controllers/journalController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "Journal", action: "CREATE" }), createJournal);

router.get("/", getAllJournals);

router.get("/stats/overview", getJournalStats);

router.get("/pending/approvals", getPendingApprovals);

router.get("/:id", getJournalById);

router.put("/:id", accessControlMiddleware({ entityKey: "Journal", action: "UPDATE" }), updateJournal);

router.post("/:id/approve", accessControlMiddleware({ entityKey: "Journal", action: "APPROVE" }), approveJournal);

router.post("/:id/reject", accessControlMiddleware({ entityKey: "Journal", action: "APPROVE" }), rejectJournal);

router.delete("/:id", accessControlMiddleware({ entityKey: "Journal", action: "DELETE" }), deleteJournal);

export default router;
