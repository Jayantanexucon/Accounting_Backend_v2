import AppError from "../../../utils/AppError.js";
import { getJournalApprovalRequestModel } from "../models/JournalApprovalRequest.js";

export const createJournalApprovalRequestRepo = async (payload) => {
  try {
    const Model = await getJournalApprovalRequestModel();
    return await Model.create(payload);
  } catch (error) {
    throw new AppError(error.message || "Failed to create journal approval request", 500, "createJournalApprovalRequestRepo");
  }
};

export const getJournalApprovalRequestByIdRepo = async (id) => {
  try {
    const Model = await getJournalApprovalRequestModel();
    return await Model.findById(id).populate("requestedBy", "name email").lean();
  } catch (error) {
    throw new AppError(error.message || "Failed to get journal approval request", 500, "getJournalApprovalRequestByIdRepo");
  }
};

export const getJournalApprovalRequestsRepo = async (filter = {}) => {
  try {
    const Model = await getJournalApprovalRequestModel();
    return await Model.find(filter)
      .populate("requestedBy", "name email")
      .sort({ requestedAt: -1, createdAt: -1 })
      .lean();
  } catch (error) {
    throw new AppError(error.message || "Failed to get journal approval requests", 500, "getJournalApprovalRequestsRepo");
  }
};

export const findPendingApprovalForJournalRepo = async (companyId, journalId, type) => {
  try {
    const Model = await getJournalApprovalRequestModel();
    return await Model.findOne({
      companyId,
      journalId,
      type,
      status: "pending",
    }).lean();
  } catch (error) {
    throw new AppError(error.message || "Failed to get pending journal approval request", 500, "findPendingApprovalForJournalRepo");
  }
};

export const updateJournalApprovalRequestRepo = async (id, updateData) => {
  try {
    const Model = await getJournalApprovalRequestModel();
    return await Model.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("requestedBy", "name email")
      .lean();
  } catch (error) {
    throw new AppError(error.message || "Failed to update journal approval request", 500, "updateJournalApprovalRequestRepo");
  }
};
