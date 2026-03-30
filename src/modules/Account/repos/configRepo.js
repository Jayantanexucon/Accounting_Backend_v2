import AppError from "../../../utils/AppError.js";
import { getConfigModel } from "../models/Config.js";

const DEFAULT_CODE_RANGES = {
  Asset: { start: 1, end: 100 },
  Liability: { start: 101, end: 200 },
  Equity: { start: 201, end: 300 },
  Income: { start: 301, end: 400 },
  Expense: { start: 401, end: 500 },
};

export const createConfigRepo = async (configData) => {
  try {
    const Config = await getConfigModel();
    const config = await Config.create(configData);
    return config;
  } catch (error) {
    throw new AppError(error.message || "Failed to create config", 500, "createConfigRepo");
  }
};

export const getConfigRepo = async (filter = {}) => {
  try {
    const Config = await getConfigModel();
    let config = await Config.findOne(filter).lean();

    if (!config && filter?.key === "accountCodeRanges" && filter?.companyId) {
      config = await Config.create({
        key: "accountCodeRanges",
        value: DEFAULT_CODE_RANGES,
        description: "Defines the code ranges for different account groups",
        companyId: filter.companyId,
      });
    }

    return config;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving config", 500, "getConfigRepo");
  }
};

export const updateConfigRepo = async (filter, updateData) => {
  try {
    const Config = await getConfigModel();
    const config = await Config.findOneAndUpdate(filter, updateData, {
      new: true,
      upsert: true,
    });
    return config;
  } catch (error) {
    throw new AppError(error.message || "Failed to update config", 500, "updateConfigRepo");
  }
};
