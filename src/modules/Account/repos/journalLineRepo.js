import AppError from "../../../utils/AppError.js";
import { getJournalLineModel } from "../models/JournalLine.js";

export const createJournalLineRepo = async (lineData) => {
  try {
    const JournalLine = await getJournalLineModel();
    const line = await JournalLine.create(lineData);
    return line;
  } catch (error) {
    throw new AppError(error.message || "Failed to create journal line", 500, "createJournalLineRepo");
  }
};

export const getJournalLinesByJournalRepo = async (journalId) => {
  try {
    const JournalLine = await getJournalLineModel();
    const lines = await JournalLine.find({ journalId })
      .populate("accountId")
      .sort({ lineNumber: 1 })
      .lean();
    return lines;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving journal lines",
      500,
      "getJournalLinesByJournalRepo"
    );
  }
};

export const createMultipleJournalLinesRepo = async (linesData) => {
  try {
    const JournalLine = await getJournalLineModel();
    const lines = await JournalLine.insertMany(linesData);
    return lines;
  } catch (error) {
    throw new AppError(
      error.message || "Failed to create journal lines",
      500,
      "createMultipleJournalLinesRepo"
    );
  }
};

export const deleteJournalLinesByJournalRepo = async (journalId) => {
  try {
    const JournalLine = await getJournalLineModel();
    await JournalLine.deleteMany({ journalId });
    return { success: true };
  } catch (error) {
    throw new AppError(
      error.message || "Failed to delete journal lines",
      500,
      "deleteJournalLinesByJournalRepo"
    );
  }
};

export const getAccountBalanceRepo = async (accountId, companyId) => {
  try {
    const JournalLine = await getJournalLineModel();
    const balance = await JournalLine.aggregate([
      {
        $match: {
          accountId: accountId,
          companyId: companyId,
        },
      },
      {
        $group: {
          _id: "$accountId",
          totalDebit: { $sum: "$debitAmount" },
          totalCredit: { $sum: "$creditAmount" },
        },
      },
    ]);
    return balance[0] || { totalDebit: 0, totalCredit: 0 };
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving account balance",
      500,
      "getAccountBalanceRepo"
    );
  }
};
