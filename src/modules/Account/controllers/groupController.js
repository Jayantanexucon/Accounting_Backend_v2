import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createGroupRepo,
  getGroupByIdRepo,
  getGroupsRepo,
  updateGroupRepo,
  deleteGroupRepo,
} from "../repos/groupRepo.js";

export const createGroup = async (req, res, next) => {
  try {
    const { name, nature, balanceType, companyId } = req.body;

    if (!name || !nature || !balanceType || !companyId) {
      throw new AppError("Missing required fields: name, nature, balanceType, companyId", 400, "createGroup");
    }

    const groupData = {
      name,
      nature,
      balanceType,
      companyId,
    };

    const group = await createGroupRepo(groupData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Group",
      entityId: group._id,
      action: "CREATE",
      changes: groupData,
      companyId,
    });

    new ApiResponse({
      statusCode: 201,
      data: group,
      message: "Group created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllGroups = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllGroups");
    }

    const groups = await getGroupsRepo({ companyId });

    new ApiResponse({
      statusCode: 200,
      data: groups,
      message: "Groups retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getGroupById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Group ID is required", 400, "getGroupById");
    }

    const group = await getGroupByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: group,
      message: "Group retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Group ID is required", 400, "updateGroup");
    }

    const oldGroup = await getGroupByIdRepo(id);

    const updatedGroup = await updateGroupRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Group",
      entityId: id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldGroup,
      companyId: oldGroup.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedGroup,
      message: "Group updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Group ID is required", 400, "deleteGroup");
    }

    const group = await getGroupByIdRepo(id);

    await deleteGroupRepo(id);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Group",
      entityId: id,
      action: "DELETE",
      changes: group,
      companyId: group.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Group deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
