import mongoose from "mongoose";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { getBankTransactionModel } from "../models/BankTransaction.js";
import { getBankReconciliationAllocationModel } from "../models/BankReconciliationAllocation.js";
import { getPaymentModel } from "../models/Payment.js";
import { getInvoiceModel } from "../../Invoice/models/Invoice.js";
import { getJournalLineModel } from "../models/JournalLine.js";
import { getJournalModel } from "../models/Journal.js";
import { getBankLedgerTransactionModel } from "../models/BankLedgerTransaction.js";
import { getAccountModel } from "../models/Account.js";
import { BankReconciliationService } from "../services/bankReconciliationService.js";
import { recordPaymentForInvoice } from "../../Invoice/controllers/invoiceAccountingController.js";

const handleControllerError = (error, res) => {
  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    status: error?.status || "error",
    message: error?.message || "Internal Server Error",
    origin: error?.origin || error?.name || "Error",
  });
};

const parseImportDate = (value) => {
  if (value == null || value === "") return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
    return parsed;
  }

  return null;
};

const getAbsoluteAmount = (value) => Math.abs(Number(value || 0));

const getAllocatedAmount = (allocations = []) =>
  allocations.reduce((sum, item) => sum + getAbsoluteAmount(item?.allocatedAmount), 0);

const getReconciliationStatus = (totalAmount, allocatedAmount) => {
  const total = getAbsoluteAmount(totalAmount);
  const allocated = Math.min(total, getAbsoluteAmount(allocatedAmount));

  if (allocated <= 0) return "UNMATCHED";
  if (allocated >= total) return "MATCHED";
  return "PARTIAL";
};

const getMonthKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toISOString().slice(0, 7);
};

const createMonthlySummaryBucket = (month) => ({
  month,
  bankTransactions: {
    count: 0,
    totalAmount: 0,
    allocatedAmount: 0,
    unallocatedAmount: 0,
    matched: { count: 0, amount: 0 },
    partial: { count: 0, amount: 0 },
    unmatched: { count: 0, amount: 0 },
  },
  journalEntries: {
    count: 0,
    totalAmount: 0,
    allocatedAmount: 0,
    unallocatedAmount: 0,
    matched: { count: 0, amount: 0 },
    partial: { count: 0, amount: 0 },
    unmatched: { count: 0, amount: 0 },
  },
  allocations: {
    count: 0,
    totalAmount: 0,
  },
});

/**
 * Normalizes output for frontend compatibility
 */
const enrichBankTransaction = (tx, allocationsByBank) => ({
  ...tx,
  transactionDate: tx.date || tx.transactionDate, // Ensure compatibility
  reference: tx.referenceNo || tx.reference,
  availableAmount: Math.max(0, Math.abs(Number(tx.amount || 0)) - Math.abs(Number(tx.allocatedAmount || 0))),
  reconciliationAllocations: (allocationsByBank.get(String(tx._id)) || []).map(a => ({
    ...a,
    bankTransactionId: String(a.bankTransactionId),
    paymentId: a.paymentId ? String(a.paymentId) : null,
    bankLedgerTransactionId: a.bankLedgerTransactionId ? String(a.bankLedgerTransactionId) : null,
  })),
});

const enrichBookEntry = (ledgerTx, paymentMap, allocationsByLedger, invoiceMap, journalLinesByJournalId) => {
  const journal = ledgerTx.journalId;
  const payment = paymentMap.get(String(journal?._id));
  const allocations = (allocationsByLedger.get(String(ledgerTx._id)) || []).map(a => ({
    ...a,
    bankTransactionId: String(a.bankTransactionId),
    journalId: a.journalId ? String(a.journalId) : null,
    bankLedgerTransactionId: a.bankLedgerTransactionId ? String(a.bankLedgerTransactionId) : null,
  }));
  const totalAmount = Math.abs(Number(ledgerTx.amount || 0));
  const allocatedAmount = Math.abs(Number(ledgerTx.allocatedAmount || 0));
  const unreconciledAmount = Math.max(0, totalAmount - allocatedAmount);
  const journalLines = (journalLinesByJournalId.get(String(journal?._id)) || []).map((line) => ({
    ...line,
    isBankLedgerLine: String(line._id) === String(ledgerTx.journalLineId),
  }));

  return {
    _id: String(ledgerTx._id),
    journalLineId: ledgerTx.journalLineId,
    journalId: journal?._id,
    paymentId: payment?._id,
    date: ledgerTx.date || journal?.date,
    amount: unreconciledAmount,
    totalAmount,
    allocatedAmount,
    unreconciledAmount,
    transactionType: ledgerTx.transactionType,
    journalNumber: journal?.number || "",
    voucherType: journal?.voucherType || "",
    reference: payment?.reference || journal?.referenceNumber || journal?.externalDocNo || "",
    description: ledgerTx.narration || journal?.narration || "",
    reconciliationStatus: ledgerTx.reconciliationStatus || "UNMATCHED",
    isReconciled: Boolean(ledgerTx.isReconciled),
    paymentDetails: payment ? {
      ...payment,
      invoice: invoiceMap.get(String(payment.invoiceId))
    } : null,
    journalLines,
    reconciliationAllocations: allocations,
    matchedBankTransactionIds: allocations.map(a => String(a.bankTransactionId)),
  };
};

export const getReconciliationOverview = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { status = "ALL", search = "", bankLedgerId } = req.query;

    if (!bankLedgerId) {
      // If no bankLedgerId is provided, we return empty data but with success
      // to avoid breaking the frontend during initial load.
      return new ApiResponse({
        statusCode: 200,
        data: {
          bankTransactions: [],
          payments: [],
          openInvoices: [],
          brs: { bookBalance: 0, bankBalance: 0, difference: 0 },
          bankSummary: { total: 0, matched: 0, unmatched: 0 },
          paymentSummary: { total: 0, matched: 0, unmatched: 0 }
        },
        message: "Please select a bank account to view reconciliation data",
      }).send(res);
    }

    const BankTransaction = await getBankTransactionModel();
    const Payment = await getPaymentModel();
    const Allocation = await getBankReconciliationAllocationModel();
    const Invoice = await getInvoiceModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const JournalLine = await getJournalLineModel();
    await getJournalModel();
    await getAccountModel();
    await BankReconciliationService.ensureBankLedgerTransactionsForAccount(companyId, bankLedgerId);

    const bankFilter = { companyId, bankLedgerId };
    if (status !== "ALL") bankFilter.reconciliationStatus = status;
    if (search) {
      bankFilter.$or = [
        { referenceNo: { $regex: search, $options: "i" } },
        { reference: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [bankTransactions, bankLedgerTransactions, payments, allocations, openInvoices] = await Promise.all([
      BankTransaction.find(bankFilter).sort({ date: -1 }).lean(),
      BankLedgerTransaction.find({
        companyId,
        bankLedgerId,
        ...(status !== "ALL" ? { reconciliationStatus: status } : {}),
      })
        .populate("journalId")
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Payment.find({ companyId }).populate("journalId").lean(),
      Allocation.find({ companyId }).lean(),
      Invoice.find({ companyId, remainingAmount: { $gt: 0 } })
        .sort({ invoiceDate: -1 })
        .limit(100)
        .lean(),
    ]);

    const allocationsByBank = new Map();
    const allocationsByLedger = new Map();
    allocations.forEach(a => {
      if (a.bankTransactionId) {
        if (!allocationsByBank.has(String(a.bankTransactionId))) allocationsByBank.set(String(a.bankTransactionId), []);
        allocationsByBank.get(String(a.bankTransactionId)).push(a);
      }
      if (a.bankLedgerTransactionId) {
        if (!allocationsByLedger.has(String(a.bankLedgerTransactionId))) allocationsByLedger.set(String(a.bankLedgerTransactionId), []);
        allocationsByLedger.get(String(a.bankLedgerTransactionId)).push(a);
      }
    });

    const paymentMap = new Map();
    payments.forEach(p => {
      if (p.journalId?._id) paymentMap.set(String(p.journalId._id), p);
    });

    const journalIds = [
      ...new Set(
        bankLedgerTransactions
          .map((entry) => entry.journalId?._id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const journalLines = journalIds.length
      ? await JournalLine.find({ journalId: { $in: journalIds } })
          .populate({ path: "accountId", select: "name code" })
          .sort({ lineNumber: 1, createdAt: 1 })
          .lean()
      : [];
    const journalLinesByJournalId = new Map();
    journalLines.forEach((line) => {
      const journalId = String(line.journalId);
      if (!journalLinesByJournalId.has(journalId)) journalLinesByJournalId.set(journalId, []);
      const populatedAccount = line.accountId && typeof line.accountId === "object" ? line.accountId : null;
      journalLinesByJournalId.get(journalId).push({
        _id: String(line._id),
        journalId,
        lineNumber: line.lineNumber,
        description: line.description || "",
        accountId: populatedAccount?._id ? String(populatedAccount._id) : String(line.accountId || ""),
        accountName: line.accountName || populatedAccount?.name || "Unknown Account",
        accountCode: line.accountCode || populatedAccount?.code || "",
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
      });
    });

    const invoiceIds = [...new Set(payments.map(p => String(p.invoiceId)).filter(id => id !== "undefined"))];
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } }).lean();
    const invoiceMap = new Map(invoices.map(i => [String(i._id), i]));

    const brs = await BankReconciliationService.getBRSReport(companyId, bankLedgerId);

    const filteredBookLedgerTransactions = search
      ? bankLedgerTransactions.filter((entry) => {
          const reference = paymentMap.get(String(entry.journalId?._id))?.reference
            || entry.journalId?.referenceNumber
            || entry.journalId?.externalDocNo
            || "";
          const description = entry.narration || entry.journalId?.narration || "";
          const q = search.toLowerCase();
          return reference.toLowerCase().includes(q) || description.toLowerCase().includes(q);
        })
      : bankLedgerTransactions;

    const bookEntries = filteredBookLedgerTransactions.map((entry) =>
      enrichBookEntry(entry, paymentMap, allocationsByLedger, invoiceMap, journalLinesByJournalId)
    );

    new ApiResponse({
      statusCode: 200,
      data: {
        bankTransactions: bankTransactions.map(tx => enrichBankTransaction(tx, allocationsByBank)),
        payments: bookEntries, // Keeping key as 'payments' to minimize frontend changes
        openInvoices,
        brs,
        bankSummary: {
          total: bankTransactions.length,
          matched: bankTransactions.filter(tx => tx.reconciliationStatus === "MATCHED").length,
          unmatched: bankTransactions.filter(tx => tx.reconciliationStatus !== "MATCHED").length,
        },
        paymentSummary: {
          total: bookEntries.length,
          matched: bookEntries.filter(p => p.reconciliationStatus === "MATCHED").length,
          unmatched: bookEntries.filter(p => p.reconciliationStatus !== "MATCHED").length,
        }
      },
      message: "Overview retrieved",
    }).send(res);

  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const getMonthlyReconciliationReport = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { bankLedgerId, startDate, endDate } = req.query;

    if (!bankLedgerId) {
      throw new AppError("bankLedgerId is required", 400);
    }

    const Account = await getAccountModel();
    const BankTransaction = await getBankTransactionModel();
    const Allocation = await getBankReconciliationAllocationModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const Journal = await getJournalModel();

    const bankLedger = await Account.findOne({ _id: bankLedgerId, companyId }).lean();
    if (!bankLedger) {
      throw new AppError("Selected bank ledger was not found for this company", 404);
    }

    await BankReconciliationService.ensureBankLedgerTransactionsForAccount(companyId, bankLedgerId);

    const start = startDate ? parseImportDate(startDate) : null;
    const end = endDate ? parseImportDate(endDate) : null;
    if (startDate && !start) {
      throw new AppError("Invalid startDate", 400);
    }
    if (endDate && !end) {
      throw new AppError("Invalid endDate", 400);
    }
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    const dateFilter = {};
    if (start) dateFilter.$gte = start;
    if (end) dateFilter.$lte = end;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const bankTransactionQuery = {
      companyId,
      bankLedgerId,
      ...(hasDateFilter ? { date: dateFilter } : {}),
    };

    const ledgerTransactionQuery = {
      companyId,
      bankLedgerId,
      ...(hasDateFilter ? { date: dateFilter } : {}),
    };

    const [bankTransactions, ledgerTransactions, allocations] = await Promise.all([
      BankTransaction.find(bankTransactionQuery).sort({ date: 1, createdAt: 1 }).lean(),
      BankLedgerTransaction.find(ledgerTransactionQuery)
        .populate({
          path: "journalId",
          select: "number voucherType date referenceNumber externalDocNo narration status approvalStatus",
        })
        .sort({ date: 1, createdAt: 1 })
        .lean(),
      Allocation.find({ companyId }).sort({ matchedAt: 1, createdAt: 1 }).lean(),
    ]);

    const bankTransactionIds = new Set(bankTransactions.map((item) => String(item._id)));
    const ledgerTransactionIds = new Set(ledgerTransactions.map((item) => String(item._id)));

    const filteredAllocations = allocations.filter((item) => {
      const bankMatch = item.bankTransactionId && bankTransactionIds.has(String(item.bankTransactionId));
      const ledgerMatch =
        item.bankLedgerTransactionId && ledgerTransactionIds.has(String(item.bankLedgerTransactionId));
      return bankMatch || ledgerMatch;
    });

    const journalIds = [
      ...new Set(
        ledgerTransactions
          .map((item) => item.journalId?._id || item.journalId)
          .filter(Boolean)
          .map((item) => String(item))
      ),
    ];
    const journals = journalIds.length
      ? await Journal.find({ _id: { $in: journalIds } })
          .select("number voucherType date referenceNumber externalDocNo narration status approvalStatus")
          .lean()
      : [];
    const journalMap = new Map(journals.map((item) => [String(item._id), item]));

    const allocationsByBankTransactionId = new Map();
    const allocationsByLedgerTransactionId = new Map();
    filteredAllocations.forEach((item) => {
      if (item.bankTransactionId) {
        const key = String(item.bankTransactionId);
        if (!allocationsByBankTransactionId.has(key)) allocationsByBankTransactionId.set(key, []);
        allocationsByBankTransactionId.get(key).push(item);
      }
      if (item.bankLedgerTransactionId) {
        const key = String(item.bankLedgerTransactionId);
        if (!allocationsByLedgerTransactionId.has(key)) allocationsByLedgerTransactionId.set(key, []);
        allocationsByLedgerTransactionId.get(key).push(item);
      }
    });

    const monthlyMap = new Map();
    const getBucket = (monthKey) => {
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, createMonthlySummaryBucket(monthKey));
      }
      return monthlyMap.get(monthKey);
    };

    const classifiedBankTransactions = bankTransactions.map((transaction) => {
      const allocationsForTransaction = allocationsByBankTransactionId.get(String(transaction._id)) || [];
      const allocatedAmount = getAllocatedAmount(allocationsForTransaction);
      const totalAmount = getAbsoluteAmount(transaction.amount);
      const unallocatedAmount = Math.max(0, totalAmount - allocatedAmount);
      const classification = getReconciliationStatus(totalAmount, allocatedAmount);
      const month = getMonthKey(transaction.date || transaction.transactionDate);

      const bucket = getBucket(month);
      bucket.bankTransactions.count += 1;
      bucket.bankTransactions.totalAmount += totalAmount;
      bucket.bankTransactions.allocatedAmount += allocatedAmount;
      bucket.bankTransactions.unallocatedAmount += unallocatedAmount;

      const statusKey = classification.toLowerCase();
      bucket.bankTransactions[statusKey].count += 1;
      bucket.bankTransactions[statusKey].amount += totalAmount;

      return {
        _id: String(transaction._id),
        date: transaction.date || transaction.transactionDate,
        valueDate: transaction.valueDate || null,
        month,
        referenceNo: transaction.referenceNo || transaction.reference || "",
        description: transaction.description || "",
        type: transaction.type || "",
        amount: totalAmount,
        allocatedAmount,
        unallocatedAmount,
        classification,
        ledgerId: transaction.bankLedgerId ? String(transaction.bankLedgerId) : null,
        allocationIds: allocationsForTransaction.map((item) => String(item._id)),
      };
    });

    const classifiedJournalEntries = ledgerTransactions.map((transaction) => {
      const allocationsForTransaction = allocationsByLedgerTransactionId.get(String(transaction._id)) || [];
      const allocatedAmount = getAllocatedAmount(allocationsForTransaction);
      const totalAmount = getAbsoluteAmount(transaction.amount);
      const unallocatedAmount = Math.max(0, totalAmount - allocatedAmount);
      const classification = getReconciliationStatus(totalAmount, allocatedAmount);
      const journal = transaction.journalId?._id
        ? transaction.journalId
        : journalMap.get(String(transaction.journalId)) || null;
      const month = getMonthKey(transaction.date || journal?.date);

      const bucket = getBucket(month);
      bucket.journalEntries.count += 1;
      bucket.journalEntries.totalAmount += totalAmount;
      bucket.journalEntries.allocatedAmount += allocatedAmount;
      bucket.journalEntries.unallocatedAmount += unallocatedAmount;

      const statusKey = classification.toLowerCase();
      bucket.journalEntries[statusKey].count += 1;
      bucket.journalEntries[statusKey].amount += totalAmount;

      return {
        _id: String(transaction._id),
        journalId: journal?._id ? String(journal._id) : transaction.journalId ? String(transaction.journalId) : null,
        journalLineId: transaction.journalLineId ? String(transaction.journalLineId) : null,
        date: transaction.date || journal?.date || null,
        month,
        journalNumber: journal?.number || "",
        voucherType: journal?.voucherType || "",
        referenceNo:
          transaction.referenceNo || journal?.referenceNumber || journal?.externalDocNo || "",
        narration: transaction.narration || journal?.narration || "",
        transactionType: transaction.transactionType || "",
        amount: totalAmount,
        allocatedAmount,
        unallocatedAmount,
        classification,
        allocationIds: allocationsForTransaction.map((item) => String(item._id)),
      };
    });

    const normalizedAllocations = filteredAllocations.map((item) => {
      const amount = getAbsoluteAmount(item.allocatedAmount);
      const linkedBankTransaction = item.bankTransactionId
        ? bankTransactions.find((tx) => String(tx._id) === String(item.bankTransactionId))
        : null;
      const linkedLedgerTransaction = item.bankLedgerTransactionId
        ? ledgerTransactions.find((tx) => String(tx._id) === String(item.bankLedgerTransactionId))
        : null;
      const month = getMonthKey(
        item.matchedAt ||
          linkedBankTransaction?.date ||
          linkedBankTransaction?.transactionDate ||
          linkedLedgerTransaction?.date
      );

      const bucket = getBucket(month);
      bucket.allocations.count += 1;
      bucket.allocations.totalAmount += amount;

      return {
        _id: String(item._id),
        month,
        matchedAt: item.matchedAt || item.createdAt || null,
        bankTransactionId: item.bankTransactionId ? String(item.bankTransactionId) : null,
        bankLedgerTransactionId: item.bankLedgerTransactionId ? String(item.bankLedgerTransactionId) : null,
        journalId: item.journalId ? String(item.journalId) : null,
        paymentId: item.paymentId ? String(item.paymentId) : null,
        allocatedAmount: amount,
        matchType: item.matchType || "MANUAL",
        note: item.note || "",
        reasons: Array.isArray(item.reasons) ? item.reasons : [],
      };
    });

    const months = Array.from(monthlyMap.values()).sort((left, right) => left.month.localeCompare(right.month));

    const reportSummary = months.reduce(
      (summary, month) => {
        summary.bankTransactions.count += month.bankTransactions.count;
        summary.bankTransactions.totalAmount += month.bankTransactions.totalAmount;
        summary.bankTransactions.allocatedAmount += month.bankTransactions.allocatedAmount;
        summary.bankTransactions.unallocatedAmount += month.bankTransactions.unallocatedAmount;
        summary.bankTransactions.matched.count += month.bankTransactions.matched.count;
        summary.bankTransactions.matched.amount += month.bankTransactions.matched.amount;
        summary.bankTransactions.partial.count += month.bankTransactions.partial.count;
        summary.bankTransactions.partial.amount += month.bankTransactions.partial.amount;
        summary.bankTransactions.unmatched.count += month.bankTransactions.unmatched.count;
        summary.bankTransactions.unmatched.amount += month.bankTransactions.unmatched.amount;

        summary.journalEntries.count += month.journalEntries.count;
        summary.journalEntries.totalAmount += month.journalEntries.totalAmount;
        summary.journalEntries.allocatedAmount += month.journalEntries.allocatedAmount;
        summary.journalEntries.unallocatedAmount += month.journalEntries.unallocatedAmount;
        summary.journalEntries.matched.count += month.journalEntries.matched.count;
        summary.journalEntries.matched.amount += month.journalEntries.matched.amount;
        summary.journalEntries.partial.count += month.journalEntries.partial.count;
        summary.journalEntries.partial.amount += month.journalEntries.partial.amount;
        summary.journalEntries.unmatched.count += month.journalEntries.unmatched.count;
        summary.journalEntries.unmatched.amount += month.journalEntries.unmatched.amount;

        summary.allocations.count += month.allocations.count;
        summary.allocations.totalAmount += month.allocations.totalAmount;

        return summary;
      },
      {
        bankTransactions: {
          count: 0,
          totalAmount: 0,
          allocatedAmount: 0,
          unallocatedAmount: 0,
          matched: { count: 0, amount: 0 },
          partial: { count: 0, amount: 0 },
          unmatched: { count: 0, amount: 0 },
        },
        journalEntries: {
          count: 0,
          totalAmount: 0,
          allocatedAmount: 0,
          unallocatedAmount: 0,
          matched: { count: 0, amount: 0 },
          partial: { count: 0, amount: 0 },
          unmatched: { count: 0, amount: 0 },
        },
        allocations: {
          count: 0,
          totalAmount: 0,
        },
      }
    );

    new ApiResponse({
      statusCode: 200,
      data: {
        bankLedger: {
          _id: String(bankLedger._id),
          code: bankLedger.code,
          name: bankLedger.name,
          groupName: bankLedger.groupName,
        },
        filters: {
          companyId,
          bankLedgerId,
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null,
        },
        summary: reportSummary,
        months,
        details: {
          bankTransactions: classifiedBankTransactions,
          journalEntries: classifiedJournalEntries,
          allocations: normalizedAllocations,
        },
      },
      message: "Monthly reconciliation report retrieved",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const importBankTransactions = async (req, res, next) => {
  try {
    const { companyId, transactions } = req.body;
    const BankTransaction = await getBankTransactionModel();

    if (!companyId) {
      throw new AppError("companyId is required", 400);
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new AppError("At least one bank transaction is required for import", 400);
    }

    const docs = transactions.map((t, index) => {
      const transactionDate = parseImportDate(t.transactionDate || t.date);
      const valueDate = parseImportDate(t.valueDate);
      const debitAmount = Math.abs(Number(t.debitAmount || 0));
      const creditAmount = Math.abs(Number(t.creditAmount || 0));
      const direction = (t.direction || t.type || (creditAmount > 0 ? "CREDIT" : debitAmount > 0 ? "DEBIT" : "CREDIT")).toUpperCase();
      const amount = Math.abs(Number(t.amount || (direction === "CREDIT" ? creditAmount : debitAmount) || 0));
      const normalizedNarration = BankReconciliationService.normalizeNarration(t.description || t.particulars || "");
      const reference = String(t.referenceNumber || t.reference || t.UTR || "").trim().toUpperCase();

      if (!transactionDate) {
        throw new AppError(`Invalid transaction date at import row ${index + 1}`, 400);
      }
      if (!amount || Number.isNaN(amount)) {
        throw new AppError(`Invalid amount at import row ${index + 1}`, 400);
      }
      if (debitAmount > 0 && creditAmount > 0) {
        throw new AppError(`Both debit and credit are filled at import row ${index + 1}`, 400);
      }

      return {
        companyId,
        date: transactionDate,
        transactionDate,
        amount,
        debitAmount,
        creditAmount,
        direction,
        type: direction,
        referenceNo: reference,
        normalizedReference: reference.replace(/[^A-Z0-9]/g, ""),
        reference,
        description: t.description || "",
        bankLedgerId: t.bankLedgerId, // Frontend should provide this
        balance: t.balance ?? t.closingBalance ?? null,
        closingBalance: t.closingBalance ?? t.balance ?? null,
        valueDate,
        fileName: t.fileName || "",
        originalRowData: t.originalRowData || null,
        normalizedNarration: normalizedNarration.normalizedNarration,
        narrationTokens: normalizedNarration.narrationTokens,
        extractedReferences: [
          ...new Set([
            ...normalizedNarration.extractedReferences,
            reference,
          ].filter(Boolean)),
        ],
        reconciliationStatus: "UNMATCHED",
        isReconciled: false,
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
      };
    });

    const inserted = await BankTransaction.insertMany(docs);
    const bankLedgerIds = [...new Set(inserted.map(item => String(item.bankLedgerId)).filter(Boolean))];
    for (const ledgerId of bankLedgerIds) {
      await BankReconciliationService.autoReconcileBankLedger(companyId, ledgerId);
    }

    new ApiResponse({
      statusCode: 201,
      data: {
        count: inserted.length,
        importedCount: inserted.length,
        bankLedgerIds,
      },
      message: "Bank statement uploaded successfully",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const autoReconcileBankTransactions = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { bankLedgerId } = req.query;
    const BankLedgerTransaction = await getBankLedgerTransactionModel();

    const targetLedgerIds = bankLedgerId
      ? [bankLedgerId]
      : [
          ...new Set(
            (
              await BankLedgerTransaction.find({ companyId }, { bankLedgerId: 1 }).lean()
            ).map((item) => String(item.bankLedgerId)).filter(Boolean)
          ),
        ];

    const exactMatches = [];
    for (const ledgerId of targetLedgerIds) {
      const allocations = await BankReconciliationService.autoReconcileBankLedger(companyId, ledgerId);
      exactMatches.push(...allocations.map((item) => ({
        bankTransactionId: item.bankTransactionId,
        bankLedgerTransactionId: item.bankLedgerTransactionId,
        allocatedAmount: item.allocatedAmount,
      })));
    }

    const exactMatchCount = exactMatches.length;
    const potentialMatchCount = 0;
    const noMatches = exactMatchCount === 0 && potentialMatchCount === 0;
    
    new ApiResponse({
      statusCode: 200,
      data: {
        exactMatches,
        potentialMatches: [],
        noMatches,
        summary: {
          processedLedgerCount: targetLedgerIds.length,
          exactMatchCount,
          potentialMatchCount,
        },
      },
      message: noMatches
        ? bankLedgerId
          ? "No matching transactions found for the selected account"
          : "No matching transactions found during auto reconciliation"
        : bankLedgerId
          ? "Auto reconciliation completed for selected account"
          : "Auto reconciliation completed for all accounts",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const manualReconcileBankTransaction = async (req, res) => {
  try {
    const { companyId, bankTransactionId, matches = [], note = "" } = req.body;
    const Allocation = await getBankReconciliationAllocationModel();
    const BankTransaction = await getBankTransactionModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const Payment = await getPaymentModel();
    const bankTx = await BankTransaction.findById(bankTransactionId).lean();

    if (!bankTx) {
      throw new AppError("Bank transaction not found", 404);
    }

    for (const m of matches) {
      const bankLedgerTransactionId = m.paymentId;
      const ledgerTx = await BankLedgerTransaction.findById(bankLedgerTransactionId).lean();
      if (!ledgerTx) continue;

      if (!BankReconciliationService.areTransactionDirectionsCompatible(bankTx, ledgerTx)) {
        throw new AppError(
          `Direction mismatch: statement ${BankReconciliationService.normalizeTransactionType(bankTx.type) || "UNKNOWN"} cannot reconcile with book ${BankReconciliationService.normalizeTransactionType(ledgerTx.transactionType) || "UNKNOWN"}`,
          400
        );
      }

      const payment = await Payment.findOne({ journalId: ledgerTx.journalId }).lean();

      await Allocation.create({
        companyId,
        bankTransactionId,
        journalId: ledgerTx.journalId,
        paymentId: payment?._id,
        bankLedgerTransactionId,
        allocatedAmount: m.allocatedAmount,
        matchType: "MANUAL",
        note,
        matchedBy: req.user?.id,
      });
      await BankReconciliationService.syncAllocationStatus(bankTransactionId, bankLedgerTransactionId);
      
      // Update associated Payment status if it exists
      if (payment) {
        const linkedLedgerTransactions = await BankLedgerTransaction.find({ companyId, journalId: ledgerTx.journalId }).lean();
        const isFullyReconciled = linkedLedgerTransactions.length > 0
          && linkedLedgerTransactions.every((item) => item.reconciliationStatus === "MATCHED");

        await Payment.findByIdAndUpdate(payment._id, {
          reconciliationStatus: isFullyReconciled ? "FULLY_RECONCILED" : "PARTIALLY_RECONCILED",
          isReconciled: isFullyReconciled,
        });
      }
    }

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Manually matched",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const unlinkReconciliation = async (req, res, next) => {
  try {
    const { companyId, paymentId, bankTransactionId } = req.body;
    const Allocation = await getBankReconciliationAllocationModel();
    const Payment = await getPaymentModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();

    const ledgerTx = await BankLedgerTransaction.findById(paymentId).lean();
    if (!ledgerTx) throw new AppError("Book entry not found", 404);

    await Allocation.deleteOne({ 
      companyId, 
      bankTransactionId,
      bankLedgerTransactionId: ledgerTx._id,
    });
    await BankReconciliationService.syncAllocationStatus(bankTransactionId, ledgerTx._id);

    const payment = await Payment.findOne({ journalId: ledgerTx.journalId }).lean();
    if (payment) {
      const relatedLedgerTransactions = await BankLedgerTransaction.find({ companyId, journalId: ledgerTx.journalId }).lean();
      const isFullyReconciled = relatedLedgerTransactions.length > 0
        && relatedLedgerTransactions.every((item) => item.reconciliationStatus === "MATCHED");
      const isPartiallyReconciled = relatedLedgerTransactions.some((item) => item.reconciliationStatus !== "UNMATCHED");

      await Payment.findByIdAndUpdate(payment._id, {
        reconciliationStatus: isFullyReconciled
          ? "FULLY_RECONCILED"
          : isPartiallyReconciled
            ? "PARTIALLY_RECONCILED"
            : "NOT_RECONCILED",
        isReconciled: isFullyReconciled,
      });
    }

    new ApiResponse({
      statusCode: 200,
      message: "Unlinked successfully",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

export const createPaymentFromBankTransaction = async (req, res, next) => {
  try {
    const { companyId, bankTransactionId, invoiceId, bankLedgerId, paymentData } = req.body;
    const Payment = await getPaymentModel();
    const Allocation = await getBankReconciliationAllocationModel();
    const BankTransaction = await getBankTransactionModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();

    if (!companyId || !bankTransactionId || !invoiceId || !bankLedgerId) {
      throw new AppError("companyId, bankTransactionId, invoiceId and bankLedgerId are required", 400);
    }

    const bankTransaction = await BankTransaction.findOne({
      _id: bankTransactionId,
      companyId,
      bankLedgerId,
    }).lean();
    if (!bankTransaction) {
      throw new AppError("Selected bank transaction not found for the chosen bank ledger", 404);
    }

    const result = await recordPaymentForInvoice({
      invoiceId,
      companyId,
      bankLedgerId,
      clientId: paymentData?.clientId || null,
      amountPaid: Number(paymentData?.amountPaid || 0),
      tdsAmount: Number(paymentData?.tdsAmount || 0),
      tdsRate: Number(paymentData?.tdsRate || 0),
      tdsSection: paymentData?.tdsSection || "",
      paymentMode: paymentData?.paymentMode || "BANK_TRANSFER",
      paymentDate: paymentData?.paymentDate || bankTransaction.transactionDate || bankTransaction.date,
      reference: paymentData?.reference || bankTransaction.reference || bankTransaction.referenceNo || "",
      notes: paymentData?.notes || bankTransaction.description || "",
      userId: req.user?.id || req.user?._id?.toString(),
      reqUser: req.user || {},
    });

    await BankReconciliationService.ensureBankLedgerTransactionsForAccount(companyId, bankLedgerId);

    const createdLedgerTransactions = await BankLedgerTransaction.find({
      companyId,
      bankLedgerId,
      journalId: result.journal?._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    const compatibleLedgerTransactions = createdLedgerTransactions.filter((ledgerTx) =>
      BankReconciliationService.areTransactionDirectionsCompatible(bankTransaction, ledgerTx)
    );

    if (!compatibleLedgerTransactions.length) {
      throw new AppError(
        `Direction mismatch: statement ${BankReconciliationService.normalizeTransactionType(bankTransaction.type) || "UNKNOWN"} does not match the generated book entry direction`,
        400
      );
    }

    const existingBankAllocations = await Allocation.find({ bankTransactionId }).lean();
    const alreadyAllocatedToBank = existingBankAllocations.reduce(
      (sum, item) => sum + Number(item.allocatedAmount || 0),
      0
    );
    let remainingBankAmount = Math.max(0, Number(bankTransaction.amount || 0) - alreadyAllocatedToBank);

    for (const ledgerTx of compatibleLedgerTransactions) {
      if (remainingBankAmount <= 0) break;

      const existingLedgerAllocations = await Allocation.find({
        bankLedgerTransactionId: ledgerTx._id,
      }).lean();
      const alreadyAllocatedToLedger = existingLedgerAllocations.reduce(
        (sum, item) => sum + Number(item.allocatedAmount || 0),
        0
      );
      const remainingLedgerAmount = Math.max(0, Number(ledgerTx.amount || 0) - alreadyAllocatedToLedger);
      const allocationAmount = Math.min(remainingBankAmount, remainingLedgerAmount);

      if (allocationAmount <= 0) continue;

      await Allocation.create({
        companyId,
        bankTransactionId,
        journalId: ledgerTx.journalId,
        paymentId: result.payment?._id || null,
        bankLedgerTransactionId: ledgerTx._id,
        allocatedAmount: allocationAmount,
        matchType: "MANUAL",
        note: "Created from bank reconciliation missing payment flow",
        matchedBy: req.user?.id,
      });

      await BankReconciliationService.syncAllocationStatus(bankTransactionId, ledgerTx._id);
      remainingBankAmount -= allocationAmount;
    }

    const payment = await Payment.findById(result.payment?._id).populate("journalId").lean();

    new ApiResponse({
      statusCode: 201,
      data: {
        payment,
        journal: result.journal,
        invoice: result.invoice,
      },
      message: "Payment created and linked",
    }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};

// Placeholder for BRS report endpoint if separate from overview
export const getBankReconciliationStatement = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { bankLedgerId } = req.query;
    const brs = await BankReconciliationService.getBRSReport(companyId, bankLedgerId);
    new ApiResponse({ statusCode: 200, data: brs }).send(res);
  } catch (error) {
    return handleControllerError(error, res);
  }
};
