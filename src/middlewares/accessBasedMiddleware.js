import AppError from "../utils/AppError.js";
import { getEntityModel } from "../modules/masterData/models/Entity.js";

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

/**
 * Access Control Middleware
 * Checks if user has permission to perform a specific action on an entity
 * 
 * Config options:
 * - entityKey: The unique key of the entity (e.g., "INVOICE", "JOURNAL", "ENTITY")
 * - action: The action to check (CREATE, EDIT, VIEW, DELETE)
 * - companyIdSource: Where to get companyId from (default: "params.companyId")
 */
export const accessControlMiddleware = (config) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      // ✅ SUPER ADMIN BYPASS - bypass all permission checks
      if (user.role === "superAdmin") {
        return next();
      }

      const { entityKey, action, companyIdSource = "params.companyId" } = config;

      if (!entityKey || !action) {
        throw new AppError("Invalid middleware configuration", 500);
      }

      // Get companyId from the specified source (usually from req.params or req.body)
      let companyId;
      const sourceParts = companyIdSource.split(".");
      let sourceValue = req;
      for (const part of sourceParts) {
        sourceValue = sourceValue?.[part];
      }
      companyId = sourceValue;

      // Get the entity by key to find its ID
      const Entity = await getEntityModel();
      const entity = await Entity.findOne({ key: entityKey });

      if (!entity) {
        throw new AppError(`Entity with key '${entityKey}' not found`, 404);
      }

      // Check if user has the required permission
      const hasPermission = user.permissions.some((perm) => {
        // Entity must match (compare with entity ID)
        if (perm.entity?.toString() !== entity._id.toString()) return false;

        // Action must exist in the permission
        if (!perm.actions || !Array.isArray(perm.actions) || !perm.actions.includes(action)) return false;

        // If companyId is specified in the request, it must match the permission
        if (companyId) {
          return perm.company?.toString() === companyId?.toString();
        }

        return true;
      });

      if (!hasPermission) {
        throw new AppError(
          `You do not have permission to ${action} this ${entityKey}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
