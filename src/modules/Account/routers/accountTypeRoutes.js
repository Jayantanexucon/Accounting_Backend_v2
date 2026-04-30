import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createAccountType,
  getAllAccountTypes,
  getAccountTypeByGroup,
  updateAccountType,
} from "../controllers/accountTypeController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "ACCOUNT_TYPE", action: "CREATE" }), createAccountType);

router.get("/", accessControlMiddleware({ entityKey: "ACCOUNT_TYPE", action: "VIEW" }), getAllAccountTypes);

router.get("/:group", accessControlMiddleware({ entityKey: "ACCOUNT_TYPE", action: "VIEW" }), getAccountTypeByGroup);

router.put("/:group", accessControlMiddleware({ entityKey: "ACCOUNT_TYPE", action: "EDIT" }), updateAccountType);

export default router;
