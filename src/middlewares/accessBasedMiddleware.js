import AppError from "../utils/AppError.js";

export const superAdminOnlyMiddleware = async (req, res, next) => {
  try {
    const user = req.user;

    if (user?.role === "admin" || user?.role === "superAdmin") {
      return next();
    }

    throw new AppError("Only admin can access these", 403);
  } catch (error) {
    next(error);
  }
};

export const accessControlMiddleware = (config) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      // ✅ SUPER ADMIN BYPASS
      if (user.role === "superAdmin") {
        return next();
      }

      const { entityKey, action } = config;
      const { companyId } = req.params;

      const hasPermission = user.permissions.some((perm) => {
        // Entity must match
        if (perm.entityId !== entityKey) return false;

        // Action must exist
        if (!perm.actions.includes(action)) return false;

        // Company must match
        if (companyId) {
          return perm.companyId?.toString() === companyId?.toString();
        }

        return true;
      });

      if (!hasPermission) {
        throw new AppError(
          "You do not have permission to perform this action",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
