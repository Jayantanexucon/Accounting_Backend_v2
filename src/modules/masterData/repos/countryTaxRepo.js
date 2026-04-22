import { getCountryTaxModel } from "../models/CountryTax.js";
import AppError from "../../../utils/AppError.js";

export const createCountryTaxRepo = async (data) => {
  try {
    const CountryTax = await getCountryTaxModel();
    return await CountryTax.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createCountryTaxRepo");
  }
};

export const getAllCountryTaxRepo = async () => {
  try {
    const CountryTax = await getCountryTaxModel();
    return await CountryTax.find({}).sort({ countryName: 1 }).populate("countryId", "countryName countryCode taxConfig");
  } catch (error) {
    throw new AppError(error.message, 500, "getAllCountryTaxRepo");
  }
};

export const findCountryTaxByIdRepo = async (id) => {
  try {
    const CountryTax = await getCountryTaxModel();
    return await CountryTax.findById(id).populate("countryId", "countryName countryCode taxConfig");
  } catch (error) {
    throw new AppError(error.message, 500, "findCountryTaxByIdRepo");
  }
};

export const findCountryTaxByCodeRepo = async (countryCode) => {
  try {
    const CountryTax = await getCountryTaxModel();
    return await CountryTax.findOne({ countryCode: countryCode.toUpperCase() });
  } catch (error) {
    throw new AppError(error.message, 500, "findCountryTaxByCodeRepo");
  }
};

export const updateCountryTaxRepo = async (id, data, updatedBy) => {
  try {
    const CountryTax = await getCountryTaxModel();

    // 1. Find existing record to create snapshot
    const existing = await CountryTax.findById(id);
    if (!existing) {
      throw new AppError("Record not found", 404, "updateCountryTaxRepo");
    }

    // 2. Add current state to snapshots
    const snapshot = {
      taxType: existing.taxType,
      taxRate: existing.taxRate,
      taxLabel: existing.taxLabel,
      description: existing.description,
      isActive: existing.isActive,
      updatedAt: existing.updatedAt || new Date(),
      updatedBy: existing.updatedBy,
    };

    // 3. Perform update with $push
    return await CountryTax.findByIdAndUpdate(
      id,
      {
        $set: data,
        $push: { snapshots: snapshot },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate("countryId", "countryName countryCode taxConfig");
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "updateCountryTaxRepo");
  }
};

export const deleteCountryTaxRepo = async (id) => {
  try {
    const CountryTax = await getCountryTaxModel();
    return await CountryTax.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteCountryTaxRepo");
  }
};
