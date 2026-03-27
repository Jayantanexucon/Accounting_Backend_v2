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

export const findHSNByIdRepo = async (id, companyId) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.findOne({ _id: id, companyId });
  } catch (error) {
    throw new AppError(error.message, 500, "findHSNByIdRepo");
  }
};

export const getAllHSNRepo = async (companyId) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.find({ companyId }).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllHSNRepo");
  }
};

export const updateHSNRepo = async (id, companyId, data) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.findOneAndUpdate({ _id: id, companyId }, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateHSNRepo");
  }
};

export const deleteHSNRepo = async (id, companyId) => {
  try {
    const HSN = await getHSNModel();
    return await HSN.findOneAndDelete({ _id: id, companyId });
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
