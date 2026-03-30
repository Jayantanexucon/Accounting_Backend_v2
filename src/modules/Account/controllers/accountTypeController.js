import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createAccountTypeRepo,
  getAccountTypeByGroupRepo,
  getAllAccountTypesRepo,
  updateAccountTypeRepo,
} from "../repos/accountTypeRepo.js";

export const createAccountType = async (req, res, next) => {
  try {
    const { group, types } = req.body;

    if (!group || !types || types.length === 0) {
      throw new AppError("Missing required fields: group, types (array)", 400, "createAccountType");
    }

    const accountTypeData = {
      group,
      types,
    };

    const accountType = await createAccountTypeRepo(accountTypeData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "AccountType",
      entityId: accountType._id,
      action: "CREATE",
      changes: accountTypeData,
    });

    new ApiResponse({
      statusCode: 201,
      data: accountType,
      message: "Account type created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllAccountTypes = async (req, res, next) => {
  try {
    const accountTypes = await getAllAccountTypesRepo();

    new ApiResponse({
      statusCode: 200,
      data: accountTypes,
      message: "Account types retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAccountTypeByGroup = async (req, res, next) => {
  try {
    const { group } = req.params;

    if (!group) {
      throw new AppError("Group is required", 400, "getAccountTypeByGroup");
    }

    const accountType = await getAccountTypeByGroupRepo(group);

    new ApiResponse({
      statusCode: 200,
      data: accountType,
      message: "Account type retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateAccountType = async (req, res, next) => {
  try {
    const { group } = req.params;
    const updateData = req.body;

    if (!group) {
      throw new AppError("Group is required", 400, "updateAccountType");
    }

    const oldAccountType = await getAccountTypeByGroupRepo(group);

    const updatedAccountType = await updateAccountTypeRepo(group, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "AccountType",
      entityId: oldAccountType._id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldAccountType,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedAccountType,
      message: "Account type updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
