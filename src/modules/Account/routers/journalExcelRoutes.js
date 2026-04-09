import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  confirmJournalExcel,
  journalExcelUploadMiddleware,
  uploadJournalExcel,
} from "../controllers/journalExcelController.js";

const router = express.Router();

router.use(protect);

router.post(
  "/:companyId/upload",
  accessControlMiddleware({ entityKey: "Journal", action: "CREATE" }),
  journalExcelUploadMiddleware.single("file"),
  uploadJournalExcel
);

router.post(
  "/:companyId/confirm",
  accessControlMiddleware({ entityKey: "Journal", action: "CREATE" }),
  confirmJournalExcel
);

export default router;
