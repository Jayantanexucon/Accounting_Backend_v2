import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createAccountRepo,
  getAccountByIdRepo,
  getAccountsRepo,
  updateAccountRepo,
  deleteAccountRepo,
  getAccountByCodeRepo,
  getLastAccountCodeInRangeRepo,
} from "../repos/accountRepo.js";
import { getGroupByIdRepo } from "../repos/groupRepo.js";
import { getConfigRepo } from "../repos/configRepo.js";

const getNextAccountCode = async (companyId, groupId) => {
  try {
    const group = await getGroupByIdRepo(groupId);
    const config = await getConfigRepo({ key: "accountCodeRanges", companyId });

    if (!config || !config.value) {
      throw new AppError("Account code ranges not configured", 400, "getNextAccountCode");
    }

    const codeRanges = config.value;
    const groupName = group.name;
    const range = codeRanges[groupName];

    if (!range) {
      throw new AppError(`No code range defined for group: ${groupName}`, 400, "getNextAccountCode");
    }

    const lastCodeInRange = await getLastAccountCodeInRangeRepo(companyId, groupName);
    const nextCode = lastCodeInRange ? lastCodeInRange + 1 : range.start;

    if (nextCode > range.end) {
      throw new AppError(`Account code range exhausted for group: ${groupName}`, 400, "getNextAccountCode");
    }

    return nextCode;
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message || "Failed to generate account code", 500, "getNextAccountCode");
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { code, name, type, groupId, companyId, openingBalance, openingType, linkedClientId, linkedVendorId } =
      req.body;

    if (!name || !type || !groupId || !companyId) {
      throw new AppError("Missing required fields: name, type, groupId, companyId", 400, "createAccount");
    }

    let accountCode = code;
    if (!accountCode) {
      accountCode = await getNextAccountCode(companyId, groupId);
    } else {
      const existingAccount = await getAccountByCodeRepo(code, companyId);
      if (existingAccount) {
        throw new AppError("Account with this code already exists", 400, "createAccount");
      }
    }

    const accountData = {
      code: accountCode,
      name,
      type,
      groupId,
      companyId,
      openingBalance: openingBalance || 0,
      openingType: openingType || "Debit",
      linkedClientId,
      linkedVendorId,
    };

    const account = await createAccountRepo(accountData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: account._id,
      action: "CREATE",
      changes: accountData,
      companyId,
    });

    new ApiResponse({
      statusCode: 201,
      data: account,
      message: "Account created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllAccounts = async (req, res, next) => {
  try {
    const { companyId, groupId, type } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllAccounts");
    }

    const filter = { companyId };
    if (groupId) filter.groupId = groupId;
    if (type) filter.type = type;

    const accounts = await getAccountsRepo(filter);

    new ApiResponse({
      statusCode: 200,
      data: accounts,
      message: "Accounts retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Account ID is required", 400, "getAccountById");
    }

    const account = await getAccountByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: account,
      message: "Account retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Account ID is required", 400, "updateAccount");
    }

    const oldAccount = await getAccountByIdRepo(id);

    const updatedAccount = await updateAccountRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldAccount,
      companyId: oldAccount.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedAccount,
      message: "Account updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Account ID is required", 400, "deleteAccount");
    }

    const account = await getAccountByIdRepo(id);

    await deleteAccountRepo(id);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: id,
      action: "DELETE",
      changes: account,
      companyId: account.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Account deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAccountByCode = async (req, res, next) => {
  try {
    const { code, companyId } = req.query;

    if (!code || !companyId) {
      throw new AppError("code and companyId are required", 400, "getAccountByCode");
    }

    const account = await getAccountByCodeRepo(code, companyId);

    if (!account) {
      throw new AppError("Account not found with this code", 404, "getAccountByCode");
    }

    new ApiResponse({
      statusCode: 200,
      data: account,
      message: "Account retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getLedger = async (req, res, next) => {
  try {
    const { accountId, startDate, endDate, companyId } = req.query;

    if (!accountId || !companyId) {
      throw new AppError("accountId and companyId are required", 400, "getLedger");
    }

    const account = await getAccountByIdRepo(accountId);

    const filter = {
      accountId,
      companyId,
    };

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    new ApiResponse({
      statusCode: 200,
      data: {
        account,
        message: "Ledger feature requires JournalLine data integration",
      },
      message: "Ledger retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
