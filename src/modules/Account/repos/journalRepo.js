import AppError from "../../../utils/AppError.js";
import mongoose from "mongoose";
import { getJournalModel } from "../models/Journal.js";
import { getJournalLineModel } from "../models/JournalLine.js";

const attachLinesToJournals = async (journals = []) => {
  if (!journals.length) return journals;

  const JournalLine = await getJournalLineModel();
  const journalIds = journals.map((journal) => journal._id);
  const lines = await JournalLine.find({ journalId: { $in: journalIds } })
    .sort({ lineNumber: 1, createdAt: 1 })
    .lean();

  const linesByJournalId = new Map();
  for (const line of lines) {
    const key = line.journalId?.toString();
    if (!linesByJournalId.has(key)) {
      linesByJournalId.set(key, []);
    }
    linesByJournalId.get(key).push({
      ...line,
      debit: Number(line.debitAmount || 0),
      credit: Number(line.creditAmount || 0),
      account: {
        _id: line.accountId,
        name: line.accountName,
        code: line.accountCode,
      },
    });
  }

  return journals.map((journal) => ({
    ...journal,
    lines: linesByJournalId.get(journal._id.toString()) || [],
  }));
};

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid journal ID", 400, "getJournalByIdRepo");
    }
    const Journal = await getJournalModel();
    const journal = await Journal.findById(id).lean();
    if (!journal) return null;
    const [journalWithLines] = await attachLinesToJournals([journal]);
    return journalWithLines;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(error.message || "Error finding journal", 500, "getJournalByIdRepo");
  }
};

export const getJournalsRepo = async (filter = {}) => {
  try {
    const Journal = await getJournalModel();
    const journals = await Journal.find(filter).sort({ date: -1 }).lean();
    return await attachLinesToJournals(journals);
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
    return await attachLinesToJournals(journals);
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving journals by approval status",
      500,
      "getJournalsByApprovalStatusRepo"
    );
  }
};
