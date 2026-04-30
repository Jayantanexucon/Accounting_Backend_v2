import { verifyAccessToken } from "../modules/auth/authService.js";
import { findUserByIdRepo } from "../modules/user/repos/userRepo.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Not authenticated", 401);
    }

    const decoded = verifyAccessToken(token);
    const user = await findUserByIdRepo(decoded.id);

    if (!user) {
      throw new AppError("User no longer exists", 401);
    }

    if (user.isBlocked) {
      throw new AppError("Your account has been blocked", 403);
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new AppError("Session expired. Please login again.", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    throw new AppError("Not authenticated", 401);
  }

  if (!roles.includes(req.user.role)) {
    throw new AppError("Forbidden", 403);
  }

  next();
};