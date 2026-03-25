import express from "express";
import {
  loginUserController,
  registerUserController,
  logoutController,
  refreshTokenHandler,
  azureSSOCallback,
} from "./authController.js";
import { protect } from "../../../middlewares/authMiddleware.js";
import passport from "passport";

const router = express.Router();

router.post("/register", registerUserController);
router.post("/login", loginUserController);
router.post("/refresh-token", refreshTokenHandler);
router.post("/logout", protect, logoutController);

// Azure SSO callback
router.get(
  "/azure/callback",
  passport.authenticate("oauth-bearer", { session: false }),
  azureSSOCallback
);

export default router;