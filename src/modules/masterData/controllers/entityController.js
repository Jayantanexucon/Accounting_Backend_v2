import { getEntityModel } from "../models/Entity.js";
import {
  createEntityRepo,
  findEntityByIdRepo,
  findEntityByKeyOrNameRepo,
  getAllEntitiesRepo,
  updateEntityRepo,
  deleteEntityRepo,
  findAllChildFromParentRepo,
} from "../repos/entityRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createEntityController = async (req, res, next) => {
  try {
    const { name, key, parent, isNavItem = false, navLink, system } = req.body;
    const userId = req.user?._id;

    if (!name || !key) {
      throw new AppError("Name and Key required", 400, "createEntity Controller");
    }

    const exists = await findEntityByKeyOrNameRepo({ name, key });
    if (exists) {
      throw new AppError("Entity already exists", 409, "createEntity Controller");
    }

    if (parent) {
      const parentExists = await findEntityByIdRepo(parent);
      if (!parentExists) {
        throw new AppError("Parent Entity does not exists", 400, "createEntity Controller");
      }
    }

    const entity = await createEntityRepo({
      name,
      key,
      parent,
      isNavItem,
      navLink,
      createdBy: userId,
      updatedBy: userId,
      system,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: entity._id,
      actionType: "ENTITY_CREATED",
      logs: [
        {
          field: "entity",
          oldValue: null,
          newValue: { name, key },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: `A new entity is created - ${entity?.name}`,
        data: entity,
        statusCode: 201,
      })
    );
  } catch (err) {
    next(err);
  }
};

export const getAllEntitiesController = async (req, res, next) => {
  try {
    const entities = await getAllEntitiesRepo();
    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: entities,
        message: "Entities fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const getEntityByIdController = async (req, res, next) => {
  try {
    const { entityId } = req.params;

    const entity = await findEntityByIdRepo(entityId);
    if (!entity) {
      throw new AppError("Entity not found", 404, "getEntityById controller");
    }

    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: entity,
        message: "Entity fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const updateEntityController = async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const { name, key, parent, navLink, system } = req.body;
    const userId = req.user?._id;

    const entity = await findEntityByIdRepo(entityId);
    if (!entity) {
      throw new AppError("Entity not found", 404, "updateEntity controller");
    }

    if (name || key) {
      const duplicate = await findEntityByKeyOrNameRepo({
        name: name || entity.name,
        key: key || entity.key,
      });

      if (duplicate && duplicate._id.toString() !== entityId) {
        throw new AppError("Name or key already exists", 409, "updateEntity controller");
      }
    }

    const updatedEntity = await updateEntityRepo(entityId, {
      ...(name && { name }),
      ...(key && { key }),
      updatedBy: userId,
      ...(parent && { parent }),
      ...(navLink && { navLink }),
      ...(system !== undefined && { system }),
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: updatedEntity._id,
      actionType: "ENTITY_UPDATED",
      logs: [
        {
          field: "entity",
          oldValue: { name: entity.name },
          newValue: { name: updatedEntity.name },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: updatedEntity,
        message: "Entity updated successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const deleteEntityController = async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const userId = req.user?._id;

    const entity = await findEntityByIdRepo(entityId);
    if (!entity) {
      throw new AppError("Entity not found", 404, "deleteEntity controller");
    }

    await deleteEntityRepo(entityId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId,
      actionType: "ENTITY_DELETED",
      logs: [
        {
          field: "entity",
          oldValue: { name: entity.name },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: null,
        message: "Entity deleted successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const getChildrenOfParentEntityController = async (req, res, next) => {
  try {
    const { parent } = req.params;

    if (!parent) {
      throw new AppError("Please provide parent to get the children", 400, "getChildrenOfParentEntity Controller");
    }

    const children = await findAllChildFromParentRepo(parent);
    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: children,
        message: "Entity children fetched successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};

export const buildTreeController = async (req, res, next) => {
  try {
    const Entity = await getEntityModel();
    const entities = await Entity.find();

    const buildTree = (parentId = null) => {
      return entities
        .filter((entity) => String(entity.parent) === String(parentId))
        .map((entity) => ({
          ...entity.toObject(),
          children: buildTree(entity._id),
        }));
    };

    const data = buildTree();
    res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: data,
        message: "Entity tree built successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};
