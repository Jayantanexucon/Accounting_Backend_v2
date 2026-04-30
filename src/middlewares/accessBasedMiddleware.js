import AppError from "../utils/AppError.js";
import { getEntityModel } from "../modules/masterData/models/Entity.js";

const normalizePermissionToken = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const normalizeAction = (value = "") =>
  String(value || "").trim().toUpperCase();

const getRequestValue = (req, sourcePath) => {
  const sourceParts = String(sourcePath || "params.companyId").split(".");
  let sourceValue = req;

  for (const part of sourceParts) {
    sourceValue = sourceValue?.[part];
  }

  if (sourceValue) {
    return sourceValue;
  }

  return (
    req?.params?.companyId ||
    req?.body?.companyId ||
    req?.query?.companyId ||
    req?.body?.data?.companyId ||
    null
  );
};

const getPermissionCompanyId = (permission) =>
  permission?.company?._id ||
  permission?.companyId ||
  permission?.company;

const getPermissionEntityId = (permission) =>
  permission?.entity?._id || permission?.entityId || permission?.entity;

const getPermissionModuleKey = (permission) =>
  permission?.module ||
  permission?.entityKey ||
  permission?.entity?.key ||
  permission?.entity?.name;

const hasPermissionAction = (permission, action) => {
  const normalizedAction = normalizeAction(action);

  if (Array.isArray(permission?.actions)) {
    return permission.actions.some(
      (item) => normalizeAction(item) === normalizedAction
    );
  }

  if (permission?.actions && typeof permission.actions === "object") {
    const matchedKey = Object.keys(permission.actions).find(
      (key) => normalizeAction(key) === normalizedAction
    );
    return Boolean(matchedKey && permission.actions[matchedKey]);
  }

  return false;
};

const findEntityByModule = async (moduleName) => {
  const Entity = await getEntityModel();
  const requestedKey = normalizePermissionToken(moduleName);
  const entities = await Entity.find({});

  return (
    entities.find((entity) => {
      const keyMatch =
        normalizePermissionToken(entity?.key) === requestedKey ||
        normalizePermissionToken(entity?.name) === requestedKey;

      return keyMatch;
    }) || null
  );
};

export const checkPermission = (moduleName, action, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      if (user.role === "superAdmin") {
        return next();
      }

      if (!moduleName || !action) {
        throw new AppError("Invalid middleware configuration", 500);
      }

      const companyId = getRequestValue(
        req,
        options.companyIdSource || "params.companyId"
      );
      const entity = await findEntityByModule(moduleName);

      if (!entity) {
        throw new AppError(`Entity with key '${moduleName}' not found`, 404);
      }

      const normalizedModule = normalizePermissionToken(moduleName);
      const hasPermission = Array.isArray(user.permissions)
        ? user.permissions.some((permission) => {
            const permissionEntityId = getPermissionEntityId(permission);
            const permissionModule = getPermissionModuleKey(permission);
            const entityMatches =
              permissionEntityId?.toString() === entity._id.toString() ||
              normalizePermissionToken(permissionModule) === normalizedModule;

            if (!entityMatches) return false;
            if (!hasPermissionAction(permission, action)) return false;

            if (companyId) {
              return (
                getPermissionCompanyId(permission)?.toString() ===
                companyId?.toString()
              );
            }

            return true;
          })
        : false;

      if (!hasPermission) {
        throw new AppError(
          `You do not have permission to ${String(action).toLowerCase()} this ${moduleName}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

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
  const { entityKey, action, companyIdSource = "params.companyId" } = config;
  return checkPermission(entityKey, action, { companyIdSource });
};
