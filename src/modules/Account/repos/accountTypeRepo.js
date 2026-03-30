import AppError from "../../../utils/AppError.js";
import { getAccountTypeModel } from "../models/AccountType.js";

export const createAccountTypeRepo = async (accountTypeData) => {
  try {
    const AccountType = await getAccountTypeModel();
    const accountType = await AccountType.create(accountTypeData);
    return accountType;
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createAccountTypeRepo");
    }
    if (error.code === 11000) {
      throw new AppError("Account type for this group already exists", 400, "createAccountTypeRepo");
    }
    throw new AppError(error.message || "Failed to create account type", 500, "createAccountTypeRepo");
  }
};

export const getAccountTypeByGroupRepo = async (group) => {
  try {
    const AccountType = await getAccountTypeModel();
    const accountType = await AccountType.findOne({ group }).lean();

    if (!accountType) {
      throw new AppError(`Account type not found for group: ${group}`, 404, "getAccountTypeByGroupRepo");
    }
    return accountType;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Error retrieving account type", 500, "getAccountTypeByGroupRepo");
  }
};

export const getAllAccountTypesRepo = async () => {
  try {
    const AccountType = await getAccountTypeModel();
    const accountTypes = await AccountType.find({}).lean();
    return accountTypes;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving account types", 500, "getAllAccountTypesRepo");
  }
};

export const updateAccountTypeRepo = async (group, updateData) => {
  try {
    const AccountType = await getAccountTypeModel();
    const accountType = await AccountType.findOneAndUpdate({ group }, updateData, { new: true });

    if (!accountType) {
      throw new AppError(`Account type not found for group: ${group}`, 404, "updateAccountTypeRepo");
    }
    return accountType;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "updateAccountTypeRepo");
    }
    throw new AppError(error.message || "Failed to update account type", 500, "updateAccountTypeRepo");
  }
};
