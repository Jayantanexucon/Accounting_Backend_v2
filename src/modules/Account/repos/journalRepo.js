import AppError from "../../../utils/AppError.js";
import { getJournalModel } from "../models/Journal.js";

export const createJournalRepo = async (journalData) => {
  try {
    const Journal = await getJournalModel();
    const journal = await Journal.create(journalData);
    return journal;
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createJournalRepo");
    }
    throw new AppError(error.message || "Failed to create journal", 500, "createJournalRepo");
  }
};

export const getJournalByIdRepo = async (id) => {
  try {
    const Journal = await getJournalModel();
    const journal = await Journal.findById(id).lean();
    return journal;
  } catch (error) {
    throw new AppError(error.message || "Error finding journal", 500, "getJournalByIdRepo");
  }
};

export const getJournalsRepo = async (filter = {}) => {
  try {
    const Journal = await getJournalModel();
    const journals = await Journal.find(filter).sort({ date: -1 }).lean();
    return journals;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving journals", 500, "getJournalsRepo");
  }
};

export const updateJournalRepo = async (id, updateData) => {
  try {
    const Journal = await getJournalModel();
    const journal = await Journal.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    return journal;
  } catch (error) {
    throw new AppError(error.message || "Failed to update journal", 500, "updateJournalRepo");
  }
};

export const deleteJournalRepo = async (id) => {
  try {
    const Journal = await getJournalModel();
    await Journal.findByIdAndDelete(id);
    return { success: true };
  } catch (error) {
    throw new AppError(error.message || "Failed to delete journal", 500, "deleteJournalRepo");
  }
};

export const getJournalStatsRepo = async (companyId) => {
  try {
    const Journal = await getJournalModel();
    const stats = await Journal.aggregate([
      { $match: { companyId: companyId, isDeleted: false } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDebit: { $sum: "$totalDebit" },
          totalCredit: { $sum: "$totalCredit" },
        },
      },
    ]);
    return stats;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving journal stats",
      500,
      "getJournalStatsRepo"
    );
  }
};

export const getJournalsByApprovalStatusRepo = async (companyId, status) => {
  try {
    const Journal = await getJournalModel();
    const journals = await Journal.find({
      companyId,
      approvalStatus: status,
      sourceType: "MANUAL",
    })
      .sort({ createdAt: -1 })
      .lean();
    return journals;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving journals by approval status",
      500,
      "getJournalsByApprovalStatusRepo"
    );
  }
};
