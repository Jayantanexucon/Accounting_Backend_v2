import { getMenuModel } from "../models/Menu.js";
import AppError from "../../../utils/AppError.js";

export const createMenuRepo = async (data) => {
  try {
    const Menu = await getMenuModel();
    return await Menu.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createMenuRepo");
  }
};

export const findMenuByIdRepo = async (id) => {
  try {
    const Menu = await getMenuModel();
    return await Menu.findById(id);
  } catch (error) {
    throw new AppError(error.message, 500, "findMenuByIdRepo");
  }
};

export const getAllMenusRepo = async (category = null) => {
  try {
    const Menu = await getMenuModel();
    const filter = { isActive: true };
    if (category) {
      filter.category = category;
    }
    return await Menu.find(filter).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllMenusRepo");
  }
};

export const updateMenuRepo = async (id, data) => {
  try {
    const Menu = await getMenuModel();
    return await Menu.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateMenuRepo");
  }
};

export const deleteMenuRepo = async (id) => {
  try {
    const Menu = await getMenuModel();
    return await Menu.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteMenuRepo");
  }
};

export const findMenuByKeyRepo = async (key) => {
  try {
    const Menu = await getMenuModel();
    return await Menu.findOne({ menuKey: key });
  } catch (error) {
    throw new AppError(error.message, 500, "findMenuByKeyRepo");
  }
};
