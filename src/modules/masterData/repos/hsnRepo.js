import { getHSNModel } from "../models/HSN.js";
import AppError from "../../../utils/AppError.js";

export const createHSNRepo = async (data) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createHSNRepo");
  }
};

export const findHSNByIdRepo = async (id) => {
  try {
    const HSN = await getHSNModel();
    // Search all HSN codes (global master data) - no companyId filter
    return await HSN.findOne({ _id: id });
  } catch (error) {
    throw new AppError(error.message, 500, "findHSNByIdRepo");
  }
};

export const getAllHSNRepo = async () => {
  try {
    const HSN = await getHSNModel();
    // Always return all HSN codes (global master data) - no companyId filter
    return await HSN.find({}).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllHSNRepo");
  }
};

export const updateHSNRepo = async (id, data) => {
  try {
    const HSN = await getHSNModel();
    // HSN is treated as global master data, so update by HSN id only.
    return await HSN.findOneAndUpdate({ _id: id }, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateHSNRepo");
  }
};

export const deleteHSNRepo = async (id) => {
  try {
    const HSN = await getHSNModel();
    // HSN is treated as global master data, so delete by HSN id only.
    return await HSN.findOneAndDelete({ _id: id });
  } catch (error) {
    throw new AppError(error.message, 500, "deleteHSNRepo");
  }
};

export const createManyHSNRepo = async (dataArray) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.insertMany(dataArray, { ordered: false });
  } catch (error) {
    throw new AppError(error.message, 500, "createManyHSNRepo");
  }
};

export const searchHSNRepo = async (companyId, searchTerm) => {
  try {
    const HSN = await getHSNModel();
    const query = { companyId };

    if (searchTerm) {
      query.$or = [
        { hsnCode: { $regex: searchTerm, $options: "i" } },
        { serviceType: { $regex: searchTerm, $options: "i" } },
      ];
    }

    return await HSN.find(query).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "searchHSNRepo");
  }
};
