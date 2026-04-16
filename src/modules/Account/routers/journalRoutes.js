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
  getJournalApprovalRequests,
  requestJournalEditApproval,
  requestJournalDeleteApproval,
  updateJournalApprovalRequest,
} from "../controllers/journalController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "JOURNAL", action: "CREATE" }), createJournal);

router.get("/", accessControlMiddleware({ entityKey: "JOURNAL", action: "VIEW" }), getAllJournals);

router.get("/stats/overview", accessControlMiddleware({ entityKey: "JOURNAL", action: "VIEW" }), getJournalStats);

router.get("/pending/approvals", accessControlMiddleware({ entityKey: "JOURNAL", action: "VIEW" }), getPendingApprovals);

router.get("/approval-requests", accessControlMiddleware({ entityKey: "JOURNAL", action: "VIEW" }), getJournalApprovalRequests);

router.put(
  "/approval-requests/:requestId",
  accessControlMiddleware({ entityKey: "JOURNAL", action: "EDIT" }),
  updateJournalApprovalRequest
);

router.post(
  "/:id/request-edit",
  accessControlMiddleware({ entityKey: "JOURNAL", action: "EDIT" }),
  requestJournalEditApproval
);

router.post(
  "/:id/request-delete",
  accessControlMiddleware({ entityKey: "JOURNAL", action: "DELETE" }),
  requestJournalDeleteApproval
);

router.get("/:id", accessControlMiddleware({ entityKey: "JOURNAL", action: "VIEW" }), getJournalById);

router.put("/:id", accessControlMiddleware({ entityKey: "JOURNAL", action: "EDIT" }), updateJournal);

router.post("/:id/approve", accessControlMiddleware({ entityKey: "JOURNAL", action: "EDIT" }), approveJournal);

router.post("/:id/reject", accessControlMiddleware({ entityKey: "JOURNAL", action: "EDIT" }), rejectJournal);

router.delete("/:id", accessControlMiddleware({ entityKey: "JOURNAL", action: "DELETE" }), deleteJournal);

export default router;
