import { getEntityModel } from "../models/Entity.js";
import AppError from "../../../utils/AppError.js";

export const createEntityRepo = async (data) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createEntityRepo");
  }
};

export const findEntityByIdRepo = async (id) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.findById(id).populate("parent").populate("createdBy").populate("updatedBy");
  } catch (error) {
    throw new AppError(error.message, 500, "findEntityByIdRepo");
  }
};

export const findEntityByKeyOrNameRepo = async ({ key, name }) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.findOne({
      $or: [{ key }, { name }],
    });
  } catch (error) {
    throw new AppError(error.message, 500, "findEntityByKeyOrNameRepo");
  }
};

export const getAllEntitiesRepo = async () => {
  try {
    const Entity = await getEntityModel();
    return await Entity.find()
      .populate("createdBy")
      .populate("updatedBy")
      .populate("parent")
      .sort({ createdAt: 1 });
  } catch (error) {
    throw new AppError(error.message, 500, "getAllEntitiesRepo");
  }
};

export const updateEntityRepo = async (id, data) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    throw new AppError(error.message, 500, "updateEntityRepo");
  }
};

export const deleteEntityRepo = async (id) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error.message, 500, "deleteEntityRepo");
  }
};

export const findAllChildFromParentRepo = async (id) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.find({ parent: id })
      .populate("parent")
      .populate("createdBy")
      .populate("updatedBy");
  } catch (error) {
    throw new AppError(error.message, 500, "findAllChildFromParentRepo");
  }
};
