import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createJournalRepo,
  getJournalByIdRepo,
  getJournalsRepo,
  updateJournalRepo,
  deleteJournalRepo,
  getJournalStatsRepo,
  getJournalsByApprovalStatusRepo,
} from "../repos/journalRepo.js";
import { createMultipleJournalLinesRepo, deleteJournalLinesByJournalRepo } from "../repos/journalLineRepo.js";

const generateJournalNumber = async (companyId, voucherType) => {
  const db = require("../models/Journal.js");
  const timestamp = Date.now();
  return `${voucherType}-${companyId}-${timestamp}`;
};

export const createJournal = async (req, res, next) => {
  try {
    const { voucherType, date, referenceNumber, narration, companyId, sourceType, sourceId, partyName, lines } =
      req.body;

    if (!voucherType || !date || !companyId || !lines || lines.length === 0) {
      throw new AppError("Missing required fields: voucherType, date, companyId, lines", 400, "createJournal");
    }

    const journalNumber = await generateJournalNumber(companyId, voucherType);

    let totalDebit = 0;
    let totalCredit = 0;

    lines.forEach((line) => {
      totalDebit += line.debitAmount || 0;
      totalCredit += line.creditAmount || 0;
    });

    const journalData = {
      number: journalNumber,
      voucherType,
      date: new Date(date),
      referenceNumber,
      narration,
      companyId,
      sourceType: sourceType || "MANUAL",
      sourceId,
      partyName,
      totalDebit,
      totalCredit,
      status: "Draft",
      approvalStatus: "Pending",
    };

    const journal = await createJournalRepo(journalData);

    const journalLinesData = lines.map((line) => ({
      journalId: journal._id,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      companyId,
      debitAmount: line.debitAmount || 0,
      creditAmount: line.creditAmount || 0,
      description: line.description,
      linkedToClientId: line.linkedToClientId,
      linkedToVendorId: line.linkedToVendorId,
      lineNumber: line.lineNumber,
    }));

    await createMultipleJournalLinesRepo(journalLinesData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Journal",
      entityId: journal._id,
      action: "CREATE",
      changes: journalData,
      companyId,
    });

    const createdJournal = await getJournalByIdRepo(journal._id);

    new ApiResponse({
      statusCode: 201,
      data: createdJournal,
      message: "Journal created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllJournals = async (req, res, next) => {
  try {
    const { companyId, status, approvalStatus, startDate, endDate } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllJournals");
    }

    const filter = { companyId };
    if (status) filter.status = status;
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const journals = await getJournalsRepo(filter);

    new ApiResponse({
      statusCode: 200,
      data: journals,
      message: "Journals retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getJournalById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Journal ID is required", 400, "getJournalById");
    }

    const journal = await getJournalByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: journal,
      message: "Journal retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateJournal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Journal ID is required", 400, "updateJournal");
    }

    const oldJournal = await getJournalByIdRepo(id);

    const updatedJournal = await updateJournalRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Journal",
      entityId: id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldJournal,
      companyId: oldJournal.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedJournal,
      message: "Journal updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteJournal = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Journal ID is required", 400, "deleteJournal");
    }

    const journal = await getJournalByIdRepo(id);

    await deleteJournalLinesByJournalRepo(id);
    await deleteJournalRepo(id);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Journal",
      entityId: id,
      action: "DELETE",
      changes: journal,
      companyId: journal.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Journal deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getJournalStats = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getJournalStats");
    }

    const stats = await getJournalStatsRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: stats,
      message: "Journal stats retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const approveJournal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalComments } = req.body;

    if (!id) {
      throw new AppError("Journal ID is required", 400, "approveJournal");
    }

    const journal = await getJournalByIdRepo(id);

    const updateData = {
      approvalStatus: "Approved",
      status: "Posted",
      approvedBy: req.user?.id,
      approvalDate: new Date(),
      approvalComments,
    };

    const approvedJournal = await updateJournalRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Journal",
      entityId: id,
      action: "APPROVE",
      changes: updateData,
      companyId: journal.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: approvedJournal,
      message: "Journal approved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const rejectJournal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalComments } = req.body;

    if (!id) {
      throw new AppError("Journal ID is required", 400, "rejectJournal");
    }

    const journal = await getJournalByIdRepo(id);

    const updateData = {
      approvalStatus: "Rejected",
      status: "Draft",
      approvedBy: req.user?.id,
      approvalDate: new Date(),
      approvalComments,
    };

    const rejectedJournal = await updateJournalRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Journal",
      entityId: id,
      action: "REJECT",
      changes: updateData,
      companyId: journal.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: rejectedJournal,
      message: "Journal rejected successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPendingApprovals = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getPendingApprovals");
    }

    const journals = await getJournalsByApprovalStatusRepo(companyId, "Pending");

    new ApiResponse({
      statusCode: 200,
      data: journals,
      message: "Pending approvals retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
