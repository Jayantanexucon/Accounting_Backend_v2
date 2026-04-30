import { getUserModel } from "../models/User.js";
import AppError from "../../../utils/AppError.js";

export const createUserRepo = async (userData) => {
  try {
    const User = await getUserModel();
    return await User.create(userData);
  } catch (error) {
    const statusCode =
      error.name === "ValidationError" ? 400 : error.code === 11000 ? 400 : 500;
    throw new AppError(error.message, statusCode, "createUserRepo");
  }
};

export const findUserRepo = async (filter) => {
  try {
    const User = await getUserModel();
    return await User.findOne(filter).select("-password");
  } catch (error) {
    throw new AppError(
      error?.message || "Error finding user",
      500,
      "findUserRepo"
    );
  }
};

export const findUserByIdRepo = async (userId) => {
  try {
    const User = await getUserModel();
    const user = await User.findById(userId).select("-password");
    
    // Optionally populate entity information if needed
    // This can be done based on your requirements
    return user;
  } catch (error) {
    throw new AppError(
      error?.message || "Error finding user by ID",
      500,
      "findUserByIdRepo"
    );
  }
};

export const updateUserRepo = async (userId, updateData) => {
  try {
    const User = await getUserModel();
    return await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");
  } catch (error) {
    throw new AppError(
      error?.message || "Error updating user",
      500,
      "updateUserRepo"
    );
  }
};

export const getAllUsersRepo = async (filter = {}) => {
  try {
    const User = await getUserModel();
    return await User.find(filter).select("-password");
  } catch (error) {
    throw new AppError(
      error?.message || "Error fetching users",
      500,
      "getAllUsersRepo"
    );
  }
};

export const deleteUserRepo = async (userId) => {
  try {
    const User = await getUserModel();
    return await User.findByIdAndDelete(userId);
  } catch (error) {
    throw new AppError(
      error?.message || "Error deleting user",
      500,
      "deleteUserRepo"
    );
  }
};