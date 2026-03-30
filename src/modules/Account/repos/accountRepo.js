import AppError from "../../../utils/AppError.js";
import { getAccountModel } from "../models/Account.js";

export const createAccountRepo = async (accountData) => {
  try {
    const Account = await getAccountModel();
    const account = await Account.create(accountData);
    return account;
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createAccountRepo");
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      let message = "Duplicate value detected";
      
      if (field === "code") {
        message = "Account code already exists for this company";
      } else if(field === "linkedClientId") {
        message = "Ledger already exists for this client";
      } else if (field === "linkedVendorId") {
        message = "Ledger already exists for this vendor";
      }
      
      throw new AppError(message, 400, "createAccountRepo");
    }
    throw new AppError(error.message || "Failed to create account", 500, "createAccountRepo");
  }
};

export const getAccountByIdRepo = async (id) => {
  try {
    const Account = await getAccountModel();
    const account = await Account.findById(id).populate("groupId").lean();
    return account;
  } catch (error) {
    throw new AppError(error.message || "Error finding account", 500, "getAccountByIdRepo");
  }
};

export const getAccountsRepo = async (filter = {}) => {
  try {
    const Account = await getAccountModel();
    const accounts = await Account.find(filter).populate("groupId").sort({ code: 1 }).lean();
    return accounts;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving accounts", 500, "getAccountsRepo");
  }
};

export const updateAccountRepo = async (id, updateData) => {
  try {
    const Account = await getAccountModel();
    const account = await Account.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("groupId");
    return account;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Account code already exists for this company", 400, "updateAccountRepo");
    }
    throw new AppError(error.message || "Failed to update account", 500, "updateAccountRepo");
  }
};

export const deleteAccountRepo = async (id) => {
  try {
    const Account = await getAccountModel();
    await Account.findByIdAndDelete(id);
    return { success: true };
  } catch (error) {
    throw new AppError(error.message || "Failed to delete account", 500, "deleteAccountRepo");
  }
};

export const getAccountByCodeRepo = async (code, companyId) => {
  try {
    const Account = await getAccountModel();
    const account = await Account.findOne({ code, companyId }).lean();
    return account;
  } catch (error) {
    throw new AppError(error.message || "Error finding account by code", 500, "getAccountByCodeRepo");
  }
};

export const getLastAccountCodeInRangeRepo = async (companyId, groupName) => {
  try {
    const Account = await getAccountModel();
    const accounts = await Account.find({
      companyId,
      groupName,
    })
      .sort({ code: -1 })
      .limit(1)
      .lean();
    return accounts[0];
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving last account code",
      500,
      "getLastAccountCodeInRangeRepo"
    );
  }
};
