import AppError from "../../../utils/AppError.js";
import { getJournalApprovalRequestModel } from "../models/JournalApprovalRequest.js";

export const createJournalApprovalRequestRepo = async (payload) => {
  try {
    const JournalApprovalRequest = await getJournalApprovalRequestModel();
    return await JournalApprovalRequest.create(payload);
  } catch (error) {
    throw new AppError(
      error.message || "Failed to create journal approval request",
      500,
      "createJournalApprovalRequestRepo"
    );
  }
};

export const findPendingApprovalForJournalRepo = async (companyId, journalId, type) => {
  try {
    const JournalApprovalRequest = await getJournalApprovalRequestModel();
    return await JournalApprovalRequest.findOne({
      companyId,
      journalId,
      type,
      status: "pending",
    }).lean();
  } catch (error) {
    throw new AppError(
      error.message || "Failed to find pending journal approval request",
      500,
      "findPendingApprovalForJournalRepo"
    );
  }
};

export const getJournalApprovalRequestByIdRepo = async (requestId) => {
  try {
    const JournalApprovalRequest = await getJournalApprovalRequestModel();
    return await JournalApprovalRequest.findById(requestId);
  } catch (error) {
    throw new AppError(
      error.message || "Failed to get journal approval request",
      500,
      "getJournalApprovalRequestByIdRepo"
    );
  }
};

export const getJournalApprovalRequestsRepo = async (filter = {}) => {
  try {
    const JournalApprovalRequest = await getJournalApprovalRequestModel();
    return await JournalApprovalRequest.find(filter).sort({ requestedAt: -1 }).lean();
  } catch (error) {
    throw new AppError(
      error.message || "Failed to get journal approval requests",
      500,
      "getJournalApprovalRequestsRepo"
    );
  }
};

export const updateJournalApprovalRequestRepo = async (requestId, updateData) => {
  try {
    const JournalApprovalRequest = await getJournalApprovalRequestModel();
    return await JournalApprovalRequest.findByIdAndUpdate(requestId, updateData, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    throw new AppError(
      error.message || "Failed to update journal approval request",
      500,
      "updateJournalApprovalRequestRepo"
    );
  }
};
