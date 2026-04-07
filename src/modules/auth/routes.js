import express from "express";
import {
  loginUserController,
  registerUserController,
  logoutController,
  refreshTokenHandler,
  accessTokenController,
  fetchMe,
  azureSSOCallback,
} from "./authController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import passport from "passport";

const router = express.Router();

// Public routes
router.post("/register", registerUserController);
router.post("/login", loginUserController);
router.post("/refresh-token", refreshTokenHandler);

// Protected routes
router.post("/me", protect, accessTokenController);
router.post("/logout", protect, logoutController);

// Azure SSO callback (only if configured)
const azureAuthMiddleware = (req, res, next) => {
  const isConfigured = process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_ID !== "your-azure-client-id";
  if (!isConfigured) {
    return res.status(501).json({
      success: false,
      message: "Azure AD SSO is not configured",
    });
  }
  passport.authenticate("oauth-bearer", { session: false })(req, res, next);
};

router.get("/azure/callback", azureAuthMiddleware, azureSSOCallback);

// Fetch authenticated user (Azure)
router.get("/fetchMe", protect, fetchMe);

export default router;
