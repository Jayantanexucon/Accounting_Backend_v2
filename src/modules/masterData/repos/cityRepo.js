import { getCityModel } from "../models/City.js";
import AppError from "../../../utils/AppError.js";

export const createCityRepo = async (data) => {
  try {
    const City = await getCityModel();
    return await City.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createCityRepo");
  }
};

export const findCityByIdRepo = async (id) => {
  try {
    const City = await getCityModel();
    return await City.findById(id).populate("state").populate("country");
  } catch (error) {
    throw new AppError(error.message, 500, "findCityByIdRepo");
  }
};

export const getCitiesByStateRepo = async (stateId) => {
  try {
    const City = await getCityModel();
    return await City.find({ state: stateId, isActive: true }).sort({ cityName: 1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getCitiesByStateRepo");
  }
};

export const getAllCitiesRepo = async () => {
  try {
    const City = await getCityModel();
    return await City.find({ isActive: true }).populate("state").populate("country").sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllCitiesRepo");
  }
};

export const updateCityRepo = async (id, data) => {
  try {
    const City = await getCityModel();
    return await City.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateCityRepo");
  }
};

export const deleteCityRepo = async (id) => {
  try {
    const City = await getCityModel();
    return await City.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteCityRepo");
  }
};
