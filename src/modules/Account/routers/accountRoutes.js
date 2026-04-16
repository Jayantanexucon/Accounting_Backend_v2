import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountByCode,
  getLedger,
} from "../controllers/accountController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "CREATE" }), createAccount);

router.get("/", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "VIEW" }), getAllAccounts);

router.get("/code/search", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "VIEW" }), getAccountByCode);

router.get("/ledger/report", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "VIEW" }), getLedger);

router.get("/:id", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "VIEW" }), getAccountById);

router.put("/:id", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "EDIT" }), updateAccount);

router.delete("/:id", accessControlMiddleware({ entityKey: "CHART OF ACCOUNTS", action: "DELETE" }), deleteAccount);

export default router;
