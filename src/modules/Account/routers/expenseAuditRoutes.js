import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { createIdentifier, deleteIdentifier, getOverview, listIdentifiers, updateIdentifier, uploadTransactions } from "../controllers/expenseAuditController.js";

const router = express.Router();
router.use(protect);
router.get("/identifiers/:companyId", listIdentifiers);
router.post("/identifiers", createIdentifier);
router.put("/identifiers/:id", updateIdentifier);
router.delete("/identifiers/:id", deleteIdentifier);
router.post("/upload", uploadTransactions);
router.get("/overview/:companyId", getOverview);
export default router;
