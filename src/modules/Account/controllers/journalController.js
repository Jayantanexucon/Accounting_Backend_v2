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
import {
  createJournalApprovalRequestRepo,
  findPendingApprovalForJournalRepo,
  getJournalApprovalRequestByIdRepo,
  getJournalApprovalRequestsRepo,
  updateJournalApprovalRequestRepo,
} from "../repos/journalApprovalRequestRepo.js";

const generateJournalNumber = async (companyId, voucherType) => {
  const timestamp = Date.now();
  return `${String(voucherType || "JOURNAL").replace(/\s+/g, "-").toUpperCase()}-${companyId}-${timestamp}`;
};

export const createJournal = async (req, res, next) => {
  try {
    const { voucherType, date, referenceNumber, externalDocNo, narration, companyId, sourceType, sourceId, partyName, lines } =
      req.body;

    if (!voucherType || !date || !companyId || !lines || lines.length === 0) {
      throw new AppError("Missing required fields: voucherType, date, companyId, lines", 400, "createJournal");
    }

    const normalizedVoucherType = normalizeVoucherType(voucherType);
    const normalizedLines = await enrichJournalLines(normalizeJournalLines(lines));
    const journalNumber = await generateJournalNumber(companyId, normalizedVoucherType);

    let totalDebit = 0;
    let totalCredit = 0;

    normalizedLines.forEach((line) => {
      totalDebit += line.debitAmount || 0;
      totalCredit += line.creditAmount || 0;
    });

    const journalData = {
      number: journalNumber,
      voucherType: normalizedVoucherType,
      date: new Date(date),
      referenceNumber,
      externalDocNo,
      narration,
      companyId,
      sourceType: sourceType || "MANUAL",
      sourceId,
      partyName,
      totalDebit,
      totalCredit,
      status: "Posted",
      approvalStatus: "Approved",
      createdBy: req.user?._id,
      status: "Posted",
      approvalStatus: "Approved",
      createdBy: req.user?._id,
    };

    const journal = await createJournalRepo(journalData);

    const journalLinesData = normalizedLines.map((line) => ({
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
    if (!id) {
      throw new AppError("Journal ID is required", 400, "updateJournal");
    }

    const { updatedJournal, updateData, oldJournal } = await applyJournalUpdate(id, req.body, req.user?._id);

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

export const getJournalApprovalRequests = async (req, res, next) => {
  try {
    const companyId = req.query.companyId;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getJournalApprovalRequests");
    }

    const requests = await getJournalApprovalRequestsRepo({ companyId });

    new ApiResponse({
      statusCode: 200,
      data: requests,
      message: "Journal approval requests retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const requestJournalEditApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId, requestComment = "" } = req.body;

    if (!id || !companyId) {
      throw new AppError("journalId and companyId are required", 400, "requestJournalEditApproval");
    }

    const journal = await getJournalByIdRepo(id);
    if (!journal || String(journal.companyId) !== String(companyId)) {
      throw new AppError("Journal not found", 404, "requestJournalEditApproval");
    }

    const pending = await findPendingApprovalForJournalRepo(companyId, id, "edit");
    if (pending) {
      throw new AppError("An edit approval request is already pending for this journal", 400, "requestJournalEditApproval");
    }

    const request = await createJournalApprovalRequestRepo({
      companyId,
      journalId: id,
      journalNumber: journal.number,
      type: "edit",
      requestedBy: req.user?._id,
      requestComment,
      requestedPayload: req.body,
    });

    new ApiResponse({
      statusCode: 201,
      data: request,
      message: "Journal edit approval request created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const requestJournalDeleteApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId, requestComment = "" } = req.body;

    if (!id || !companyId) {
      throw new AppError("journalId and companyId are required", 400, "requestJournalDeleteApproval");
    }

    const journal = await getJournalByIdRepo(id);
    if (!journal || String(journal.companyId) !== String(companyId)) {
      throw new AppError("Journal not found", 404, "requestJournalDeleteApproval");
    }

    const pending = await findPendingApprovalForJournalRepo(companyId, id, "delete");
    if (pending) {
      throw new AppError("A delete approval request is already pending for this journal", 400, "requestJournalDeleteApproval");
    }

    const request = await createJournalApprovalRequestRepo({
      companyId,
      journalId: id,
      journalNumber: journal.number,
      type: "delete",
      requestedBy: req.user?._id,
      requestComment,
      requestedPayload: null,
    });

    new ApiResponse({
      statusCode: 201,
      data: request,
      message: "Journal delete approval request created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateJournalApprovalRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!requestId || !status) {
      throw new AppError("requestId and status are required", 400, "updateJournalApprovalRequest");
    }

    if (!["approved", "rejected"].includes(status)) {
      throw new AppError("Invalid approval status", 400, "updateJournalApprovalRequest");
    }

    const approvalRequest = await getJournalApprovalRequestByIdRepo(requestId);
    if (!approvalRequest) {
      throw new AppError("Approval request not found", 404, "updateJournalApprovalRequest");
    }

    if (approvalRequest.status !== "pending") {
      throw new AppError("Approval request has already been processed", 400, "updateJournalApprovalRequest");
    }

    if (status === "approved") {
      if (approvalRequest.type === "delete") {
        await deleteJournalLinesByJournalRepo(approvalRequest.journalId);
        await deleteJournalRepo(approvalRequest.journalId);
      } else if (approvalRequest.type === "edit" && approvalRequest.requestedPayload) {
        const payload = { ...approvalRequest.requestedPayload };
        delete payload.companyId;
        delete payload.requestComment;
        await updateJournalRepo(approvalRequest.journalId, payload);
      }
    }

    const updatedRequest = await updateJournalApprovalRequestRepo(requestId, {
      status: status === "approved" ? "completed" : "rejected",
      ...(status === "approved"
        ? { approvedBy: req.user?._id, approvedAt: new Date(), completedAt: new Date() }
        : { rejectedBy: req.user?._id, rejectedAt: new Date() }),
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedRequest,
      message: `Journal approval request ${status} successfully`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};
