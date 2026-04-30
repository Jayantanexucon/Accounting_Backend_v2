import { getCurrencyModel } from "../models/Currency.js";
import AppError from "../../../utils/AppError.js";

export const createCurrencyRepo = async (data) => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createCurrencyRepo");
  }
};

export const findCurrencyByIdRepo = async (id) => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.findById(id);
  } catch (error) {
    throw new AppError(error.message, 500, "findCurrencyByIdRepo");
  }
};

export const getAllCurrenciesRepo = async () => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.find({ isActive: true }).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllCurrenciesRepo");
  }
};

export const updateCurrencyRepo = async (id, data) => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateCurrencyRepo");
  }
};

export const deleteCurrencyRepo = async (id) => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteCurrencyRepo");
  }
};

export const findCurrencyByCodeRepo = async (code) => {
  try {
    const Currency = await getCurrencyModel();
    return await Currency.findOne({ currencyCode: code });
  } catch (error) {
    throw new AppError(error.message, 500, "findCurrencyByCodeRepo");
  }
};
