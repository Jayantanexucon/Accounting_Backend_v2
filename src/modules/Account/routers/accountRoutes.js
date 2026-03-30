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

router.post("/", accessControlMiddleware({ entityKey: "Account", action: "CREATE" }), createAccount);

router.get("/", getAllAccounts);

router.get("/code/search", getAccountByCode);

router.get("/ledger/report", getLedger);

router.get("/:id", getAccountById);

router.put("/:id", accessControlMiddleware({ entityKey: "Account", action: "UPDATE" }), updateAccount);

router.delete("/:id", accessControlMiddleware({ entityKey: "Account", action: "DELETE" }), deleteAccount);

export default router;
