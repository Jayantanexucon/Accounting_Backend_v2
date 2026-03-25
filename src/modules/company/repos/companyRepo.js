import { getCompanyModel } from "../models/Company.js";
import AppError from "../../../utils/AppError.js";

export const createCompanyRepo = async (companyData) => {
  try {
    const Company = await getCompanyModel();
    return await Company.create(companyData);
  } catch (error) {
    const statusCode =
      error.name === "ValidationError" ? 400 : error.code === 11000 ? 400 : 500;
    throw new AppError(error.message, statusCode, "createCompanyRepo");
  }
};

export const findCompaniesRepo = async (filter) => {
  try {
    const Company = await getCompanyModel();
    return await Company.find(filter);
  } catch (error) {
    throw new AppError(
      error?.message || "Error finding companies",
      500,
      "findCompaniesRepo"
    );
  }
};

export const findCompanyByIdRepo = async (companyId) => {
  try {
    const Company = await getCompanyModel();
    return await Company.findById(companyId);
  } catch (error) {
    throw new AppError(
      error?.message || "Error finding company by ID",
      500,
      "findCompanyByIdRepo"
    );
  }
};

export const updateCompanyRepo = async (companyId, updateData) => {
  try {
    const Company = await getCompanyModel();
    return await Company.findByIdAndUpdate(companyId, updateData, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    throw new AppError(
      error?.message || "Error updating company",
      500,
      "updateCompanyRepo"
    );
  }
};

export const deleteCompanyRepo = async (companyId) => {
  try {
    const Company = await getCompanyModel();
    return await Company.findByIdAndDelete(companyId);
  } catch (error) {
    throw new AppError(
      error?.message || "Error deleting company",
      500,
      "deleteCompanyRepo"
    );
  }
};
