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
import { getAccountByIdRepo } from "../repos/accountRepo.js";
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

const normalizeVoucherType = (value = "") => {
  const normalized = value.toString().trim().toUpperCase();

  switch (normalized) {
    case "JOURNAL":
    case "JOURNAL ENTRY":
      return "Journal Entry";
    case "RECEIPT":
      return "Receipt";
    case "PAYMENT":
      return "Payment";
    case "CONTRA":
      return "Contra";
    default:
      return value;
  }
};

const normalizeJournalLines = (lines = []) =>
  lines.map((line, index) => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    debitAmount: Number(line.debitAmount ?? line.debit ?? 0),
    creditAmount: Number(line.creditAmount ?? line.credit ?? 0),
    description: line.description,
    linkedToClientId: line.linkedToClientId,
    linkedToVendorId: line.linkedToVendorId,
    lineNumber: line.lineNumber ?? index + 1,
  }));

const enrichJournalLines = async (lines = []) =>
  Promise.all(
    lines.map(async (line) => {
      if (line.accountCode && line.accountName) {
        return line;
      }

      const account = await getAccountByIdRepo(line.accountId);
      if (!account) {
        throw new AppError("Account not found for journal line", 404, "enrichJournalLines");
      }

      return {
        ...line,
        accountCode: line.accountCode || account.code,
        accountName: line.accountName || account.name,
      };
    })
  );

const applyJournalUpdate = async (journalId, payload, actorId, existingJournal = null) => {
  const oldJournal = existingJournal || (await getJournalByIdRepo(journalId));
  if (!oldJournal) {
    throw new AppError("Journal not found", 404, "applyJournalUpdate");
  }

  const { lines, voucherType, date, referenceNumber, externalDocNo, narration, companyId, sourceType, sourceId, partyName } =
    payload;

  const normalizedLines = Array.isArray(lines)
    ? await enrichJournalLines(normalizeJournalLines(lines))
    : [];

  let totalDebit = 0;
  let totalCredit = 0;
  normalizedLines.forEach((line) => {
    totalDebit += line.debitAmount || 0;
    totalCredit += line.creditAmount || 0;
  });

  const updateData = {
    ...(voucherType ? { voucherType: normalizeVoucherType(voucherType) } : {}),
    ...(date ? { date: new Date(date) } : {}),
    ...(referenceNumber !== undefined ? { referenceNumber } : {}),
    ...(externalDocNo !== undefined ? { externalDocNo } : {}),
    ...(narration !== undefined ? { narration } : {}),
    ...(companyId ? { companyId } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(sourceId !== undefined ? { sourceId } : {}),
    ...(partyName !== undefined ? { partyName } : {}),
    ...(Array.isArray(lines) ? { totalDebit, totalCredit } : {}),
    updatedBy: actorId,
  };

  const updatedJournal = await updateJournalRepo(journalId, updateData);

  if (Array.isArray(lines)) {
    await deleteJournalLinesByJournalRepo(journalId);
    if (normalizedLines.length) {
      await createMultipleJournalLinesRepo(
        normalizedLines.map((line) => ({
          ...line,
          journalId,
          companyId: companyId || oldJournal.companyId,
        }))
      );
    }
  }

  return { updatedJournal, updateData, oldJournal };
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
    const companyId = req.query.companyId || req.params.companyId;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getJournalApprovalRequests");
    }

    const filter = { companyId };
    const isAdmin =
      req.user?.role === "superAdmin" ||
      req.user?.role === "admin" ||
      req.user?.privilege?.masterUpdate === true;

    if (!isAdmin) {
      filter.requestedBy = req.user?._id;
    }

    const requests = await getJournalApprovalRequestsRepo(filter);

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
    const journalId = req.params.id || req.params.journalId;
    const companyId = req.body.companyId || req.params.companyId;

    if (!journalId || !companyId) {
      throw new AppError("journalId and companyId are required", 400, "requestJournalEditApproval");
    }

    const journal = await getJournalByIdRepo(journalId);
    if (!journal) {
      throw new AppError("Journal not found", 404, "requestJournalEditApproval");
    }

    const pendingRequest = await findPendingApprovalForJournalRepo(companyId, journalId, "edit");
    if (pendingRequest) {
      throw new AppError("An edit approval request is already pending for this journal", 400, "requestJournalEditApproval");
    }

    const request = await createJournalApprovalRequestRepo({
      companyId,
      journalId,
      journalNumber: journal.number,
      type: "edit",
      requestedBy: req.user?._id,
      requestComment: req.body.requestComment || "",
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
    const journalId = req.params.id || req.params.journalId;
    const companyId = req.body.companyId || req.params.companyId;

    if (!journalId || !companyId) {
      throw new AppError("journalId and companyId are required", 400, "requestJournalDeleteApproval");
    }

    const journal = await getJournalByIdRepo(journalId);
    if (!journal) {
      throw new AppError("Journal not found", 404, "requestJournalDeleteApproval");
    }

    const pendingRequest = await findPendingApprovalForJournalRepo(companyId, journalId, "delete");
    if (pendingRequest) {
      throw new AppError("A delete approval request is already pending for this journal", 400, "requestJournalDeleteApproval");
    }

    const request = await createJournalApprovalRequestRepo({
      companyId,
      journalId,
      journalNumber: journal.number,
      type: "delete",
      requestedBy: req.user?._id,
      requestComment: req.body.requestComment || "",
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

    const approvalRequest = await getJournalApprovalRequestByIdRepo(requestId);
    if (!approvalRequest) {
      throw new AppError("Approval request not found", 404, "updateJournalApprovalRequest");
    }
    if (approvalRequest.status !== "pending") {
      throw new AppError("Approval request has already been processed", 400, "updateJournalApprovalRequest");
    }

    if (status === "approved") {
      if (approvalRequest.type === "edit" && approvalRequest.requestedPayload) {
        await applyJournalUpdate(
          approvalRequest.journalId,
          approvalRequest.requestedPayload,
          req.user?._id,
          await getJournalByIdRepo(approvalRequest.journalId),
        );
      }

      if (approvalRequest.type === "delete") {
        await deleteJournalLinesByJournalRepo(approvalRequest.journalId);
        await deleteJournalRepo(approvalRequest.journalId);
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
