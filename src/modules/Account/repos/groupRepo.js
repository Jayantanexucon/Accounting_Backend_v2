import AppError from "../../../utils/AppError.js";
import { getGroupModel } from "../models/Group.js";

export const createGroupRepo = async (groupData) => {
  try {
    const Group = await getGroupModel();
    const group = await Group.create(groupData);
    return group;
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createGroupRepo");
    }
    if (error.code === 11000) {
      throw new AppError("Group name already exists for this company", 400, "createGroupRepo");
    }
    throw new AppError(error.message || "Failed to create group", 500, "createGroupRepo");
  }
};

export const getGroupByIdRepo = async (id) => {
  try {
    const Group = await getGroupModel();
    const group = await Group.findById(id).lean();
    return group;
  } catch (error) {
    throw new AppError(error.message || "Error finding group", 500, "getGroupByIdRepo");
  }
};

export const getGroupsRepo = async (filter = {}) => {
  try {
    const Group = await getGroupModel();
    const groups = await Group.find(filter).sort({ createdAt: -1 }).lean();
    return groups;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving groups", 500, "getGroupsRepo");
  }
};

export const updateGroupRepo = async (id, updateData) => {
  try {
    const Group = await getGroupModel();
    const group = await Group.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    return group;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Group name already exists", 400, "updateGroupRepo");
    }
    throw new AppError(error.message || "Failed to update group", 500, "updateGroupRepo");
  }
};

export const deleteGroupRepo = async (id) => {
  try {
    const Group = await getGroupModel();
    await Group.findByIdAndDelete(id);
    return { success: true };
  } catch (error) {
    throw new AppError(error.message || "Failed to delete group", 500, "deleteGroupRepo");
  }
};
