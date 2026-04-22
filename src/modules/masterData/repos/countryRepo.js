import { getCountryModel } from "../models/Country.js";
import AppError from "../../../utils/AppError.js";

export const createCountryRepo = async (data) => {
  try {
    const Country = await getCountryModel();
    return await Country.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createCountryRepo");
  }
};

export const findCountryByIdRepo = async (id) => {
  try {
    const Country = await getCountryModel();
    return await Country.findById(id);
  } catch (error) {
    throw new AppError(error.message, 500, "findCountryByIdRepo");
  }
};

export const getAllCountriesRepo = async () => {
  try {
    const Country = await getCountryModel();
    return await Country.find({ isActive: true }).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllCountriesRepo");
  }
};

export const updateCountryRepo = async (id, data) => {
  try {
    const Country = await getCountryModel();
    return await Country.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateCountryRepo");
  }
};

export const deleteCountryRepo = async (id) => {
  try {
    const Country = await getCountryModel();
    return await Country.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteCountryRepo");
  }
};

export const findCountryByCodeRepo = async (code) => {
  try {
    const Country = await getCountryModel();
    return await Country.findOne({ countryCode: code });
  } catch (error) {
    throw new AppError(error.message, 500, "findCountryByCodeRepo");
  }
};

export const findCountryByNameRepo = async (countryName) => {
  try {
    const Country = await getCountryModel();
    return await Country.findOne({ countryName });
  } catch (error) {
    throw new AppError(error.message, 500, "findCountryByNameRepo");
  }
};
