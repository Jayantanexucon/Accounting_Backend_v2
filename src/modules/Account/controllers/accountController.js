import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createAccountRepo,
  getAccountByIdRepo,
  getAccountsRepo,
  updateAccountRepo,
  deleteAccountRepo,
  getAccountByCodeRepo,
  getLastAccountCodeInRangeRepo,
} from "../repos/accountRepo.js";
import { getGroupByIdRepo } from "../repos/groupRepo.js";
import { getConfigRepo } from "../repos/configRepo.js";
import { getJournalLineModel } from "../models/JournalLine.js";

const deriveLedgerPropertiesFromGroup = (group) => {
  const nature = group?.nature;
  const type = nature === "Income" || nature === "Expense" ? "revenueAccount" : "balanceSheet";
  const openingType = group?.balanceType || (nature === "Liability" || nature === "Equity" || nature === "Income" ? "Credit" : "Debit");
  const subType =
    type === "balanceSheet"
      ? group?.scheduleGroup?.toLowerCase().includes("non-current")
        ? "nonCurrent"
        : "current"
      : null;

  return {
    type,
    openingType,
    subType,
    scheduleMapping: {
      reportType: type === "balanceSheet" ? "balance_sheet" : "profit_and_loss",
    },
  };
};

const normalizeOpeningType = (value = "Debit") =>
  `${value}`.toLowerCase() === "credit" ? "credit" : "debit";

const computeClosingForAccount = (account, totalDebit = 0, totalCredit = 0) => {
  const openingBalance = Number(account.openingBalance || 0);
  const openingType = normalizeOpeningType(account.openingType);
  const netBalance =
    openingType === "debit"
      ? openingBalance + totalDebit - totalCredit
      : openingBalance + totalCredit - totalDebit;

  return {
    closingBalance: Math.abs(netBalance),
    closingType: netBalance >= 0 ? openingType : openingType === "debit" ? "credit" : "debit",
  };
};

const attachAccountBalances = async (accounts = [], companyId) => {
  if (!accounts.length) return [];

  const JournalLine = await getJournalLineModel();
  const balances = await JournalLine.aggregate([
    {
      $match: {
        companyId,
        accountId: { $in: accounts.map((account) => account._id) },
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

  const balanceMap = new Map(
    balances.map((item) => [
      item._id.toString(),
      { totalDebit: Number(item.totalDebit || 0), totalCredit: Number(item.totalCredit || 0) },
    ])
  );

  return accounts.map((account) => {
    const totals = balanceMap.get(account._id.toString()) || { totalDebit: 0, totalCredit: 0 };
    return {
      ...account,
      ...computeClosingForAccount(account, totals.totalDebit, totals.totalCredit),
    };
  });
};

const getNextAccountCode = async (companyId, groupId) => {
  try {
    const group = await getGroupByIdRepo(groupId);
    const config = await getConfigRepo({ key: "accountCodeRanges", companyId });

    if (!config || !config.value) {
      throw new AppError("Account code ranges not configured", 400, "getNextAccountCode");
    }

    const codeRanges = config.value;
    const groupName = group.name;
    const range = codeRanges[groupName];

    if (!range) {
      throw new AppError(`No code range defined for group: ${groupName}`, 400, "getNextAccountCode");
    }

    const lastCodeInRange = await getLastAccountCodeInRangeRepo(companyId, groupName);
    const lastUsedCode = Number(lastCodeInRange?.code || 0);
    const nextCode = lastUsedCode ? lastUsedCode + 1 : range.start;

    if (nextCode > range.end) {
      throw new AppError(`Account code range exhausted for group: ${groupName}`, 400, "getNextAccountCode");
    }

    return nextCode;
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message || "Failed to generate account code", 500, "getNextAccountCode");
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { code, name, groupId, companyId, openingBalance, openingType, linkedClientId, linkedVendorId, description } =
      req.body;

    if (!name || !groupId || !companyId) {
      throw new AppError("Missing required fields: name, groupId, companyId", 400, "createAccount");
    }

    const group = await getGroupByIdRepo(groupId);
    if (!group) {
      throw new AppError("Selected group not found", 404, "createAccount");
    }

    if (String(group.companyId) !== String(companyId)) {
      throw new AppError("Selected group does not belong to this company", 400, "createAccount");
    }

    const derivedProperties = deriveLedgerPropertiesFromGroup(group);

    let accountCode = code;
    if (!accountCode) {
      accountCode = await getNextAccountCode(companyId, groupId);
    } else {
      const existingAccount = await getAccountByCodeRepo(code, companyId);
      if (existingAccount) {
        throw new AppError("Account with this code already exists", 400, "createAccount");
      }
    }

    const accountData = {
      code: accountCode,
      name,
      type: derivedProperties.type,
      groupId,
      groupName: group.name,
      companyId,
      openingBalance: Number(openingBalance || 0),
      openingType: normalizeOpeningType(openingType || derivedProperties.openingType),
      subType: derivedProperties.subType,
      linkedClientId: linkedClientId || null,
      linkedVendorId: linkedVendorId || null,
      description: description || "",
      scheduleMapping: {
        scheduleMainHead: group.scheduleMainHead || null,
        scheduleGroup: group.scheduleGroup || null,
        scheduleLineItem: group.scheduleLineItem || null,
        noteNo: group.noteNo || null,
        reportType: derivedProperties.scheduleMapping.reportType,
      },
      createdBy: req.user?.id,
    };

    const account = await createAccountRepo(accountData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: account._id,
      action: "CREATE",
      changes: accountData,
      companyId,
    });

    new ApiResponse({
      statusCode: 201,
      data: account,
      message: "Account created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllAccounts = async (req, res, next) => {
  try {
    const { companyId, groupId, type } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllAccounts");
    }

    const filter = { companyId };
    if (groupId) filter.groupId = groupId;
    if (type) filter.type = type;

    const accounts = await getAccountsRepo(filter);
    const accountsWithBalances = await attachAccountBalances(accounts, companyId);

    new ApiResponse({
      statusCode: 200,
      data: accountsWithBalances,
      message: "Accounts retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Account ID is required", 400, "getAccountById");
    }

    const account = await getAccountByIdRepo(id);
    if (!account) {
      throw new AppError("Account not found", 404, "getAccountById");
    }
    const [accountWithBalance] = await attachAccountBalances([account], account.companyId);

    new ApiResponse({
      statusCode: 200,
      data: accountWithBalance,
      message: "Account retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Account ID is required", 400, "updateAccount");
    }

    const oldAccount = await getAccountByIdRepo(id);
    if (!oldAccount) {
      throw new AppError("Account not found", 404, "updateAccount");
    }

    const nextGroupId = req.body.groupId || oldAccount.groupId?._id || oldAccount.groupId;
    const group = await getGroupByIdRepo(nextGroupId);
    if (!group) {
      throw new AppError("Selected group not found", 404, "updateAccount");
    }

    const derivedProperties = deriveLedgerPropertiesFromGroup(group);

    const updateData = {
      ...req.body,
      type: derivedProperties.type,
      groupId: nextGroupId,
      groupName: group.name,
      openingBalance:
        req.body.openingBalance !== undefined ? Number(req.body.openingBalance || 0) : oldAccount.openingBalance,
      openingType: normalizeOpeningType(req.body.openingType || derivedProperties.openingType),
      subType: derivedProperties.subType,
      scheduleMapping: {
        scheduleMainHead: group.scheduleMainHead || null,
        scheduleGroup: group.scheduleGroup || null,
        scheduleLineItem: group.scheduleLineItem || null,
        noteNo: group.noteNo || null,
        reportType: derivedProperties.scheduleMapping.reportType,
      },
      updatedBy: req.user?.id,
    };

    const updatedAccount = await updateAccountRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldAccount,
      companyId: oldAccount.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedAccount,
      message: "Account updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Account ID is required", 400, "deleteAccount");
    }

    const account = await getAccountByIdRepo(id);

    await deleteAccountRepo(id);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Account",
      entityId: id,
      action: "DELETE",
      changes: account,
      companyId: account.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Account deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAccountByCode = async (req, res, next) => {
  try {
    const { code, companyId } = req.query;

    if (!code || !companyId) {
      throw new AppError("code and companyId are required", 400, "getAccountByCode");
    }

    const account = await getAccountByCodeRepo(code, companyId);

    if (!account) {
      throw new AppError("Account not found with this code", 404, "getAccountByCode");
    }

    new ApiResponse({
      statusCode: 200,
      data: account,
      message: "Account retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getLedger = async (req, res, next) => {
  try {
    const { accountId, startDate, endDate, companyId } = req.query;

    if (!accountId || !companyId) {
      throw new AppError("accountId and companyId are required", 400, "getLedger");
    }

    const account = await getAccountByIdRepo(accountId);
    if (!account || String(account.companyId) !== String(companyId)) {
      throw new AppError("Account not found", 404, "getLedger");
    }

    const JournalLine = await getJournalLineModel();
    const lines = await JournalLine.find({
      accountId,
      companyId,
    })
      .populate({
        path: "journalId",
        select: "number date narration sourceType referenceNumber partyName externalDocNo createdAt",
      })
      .sort({ createdAt: 1 })
      .lean();

    let openingBalance =
      `${account.openingType}`.toLowerCase() === "debit"
        ? Number(account.openingBalance || 0)
        : -Number(account.openingBalance || 0);

    const filteredLines = [];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    for (const line of lines) {
      if (!line.journalId) continue;
      const journalDate = new Date(line.journalId.date || line.createdAt);
      if (Number.isNaN(journalDate.getTime())) continue;

      if (start && journalDate < start) {
        // Add to true opening balance
        const debit = Number(line.debitAmount || 0);
        const credit = Number(line.creditAmount || 0);
        openingBalance += debit - credit;
      } else {
        if (end && journalDate > end) continue;
        filteredLines.push(line);
      }
    }

    let runningBalance = openingBalance;

    const entries = filteredLines.map((line) => {
      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);
      runningBalance += debit - credit;

      return {
        date: line.journalId.date,
        narration: line.journalId.narration,
        debit,
        credit,
        balance: runningBalance,
        sourceType: line.journalId.sourceType || "MANUAL",
        referenceNumber: line.journalId.referenceNumber || line.journalId.number,
        partyName: line.journalId.partyName || null,
        externalDocNo: line.journalId.externalDocNo || null,
        createdAt: line.journalId.createdAt || line.createdAt,
        toBy: debit > 0 ? "To" : "By",
        counters: [],
      };
    });

    new ApiResponse({
      statusCode: 200,
      data: {
        account,
        entries,
        openingBalance: Math.abs(openingBalance),
        openingType: openingBalance >= 0 ? "debit" : "credit",
        closingBalance: Math.abs(runningBalance),
        closingType: runningBalance >= 0 ? "debit" : "credit",
      },
      message: "Ledger retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
