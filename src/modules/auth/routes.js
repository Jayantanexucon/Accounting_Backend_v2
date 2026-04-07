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
  if (!passport._strategy("oauth-bearer")) {
    return res.status(500).json({
      success: false,
      message: "Azure AD bearer strategy is not initialized",
    });
  }
  passport.authenticate(
    "oauth-bearer",
    { session: false },
    (error, user, info) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message || "Azure authentication failed",
          details: info || null,
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || "Unauthorized",
          details: info || null,
        });
      }

      req.user = user;
      next();
    }
  )(req, res, next);
};

router.get("/azure/callback", azureAuthMiddleware, azureSSOCallback);

// Fetch authenticated user from Azure access token
router.get("/fetchMe", azureAuthMiddleware, fetchMe);

export default router;
