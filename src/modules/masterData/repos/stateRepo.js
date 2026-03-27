import { getStateModel } from "../models/State.js";
import AppError from "../../../utils/AppError.js";

export const createStateRepo = async (data) => {
  try {
    const State = await getStateModel();
    return await State.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createStateRepo");
  }
};

export const findStateByIdRepo = async (id) => {
  try {
    const State = await getStateModel();
    return await State.findById(id).populate("country");
  } catch (error) {
    throw new AppError(error.message, 500, "findStateByIdRepo");
  }
};

export const getStatesByCountryRepo = async (countryId) => {
  try {
    const State = await getStateModel();
    return await State.find({ country: countryId, isActive: true }).sort({ stateName: 1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getStatesByCountryRepo");
  }
};

export const getAllStatesRepo = async () => {
  try {
    const State = await getStateModel();
    return await State.find({ isActive: true }).populate("country").sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllStatesRepo");
  }
};

export const updateStateRepo = async (id, data) => {
  try {
    const State = await getStateModel();
    return await State.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateStateRepo");
  }
};

export const deleteStateRepo = async (id) => {
  try {
    const State = await getStateModel();
    return await State.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteStateRepo");
  }
};
