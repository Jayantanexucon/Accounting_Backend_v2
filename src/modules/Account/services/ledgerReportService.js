import AppError from "../../../utils/AppError.js";
import { getAccountModel } from "../models/Account.js";
import { getJournalLineModel } from "../models/JournalLine.js";
import { getJournalModel } from "../models/Journal.js";
import {
  filterJournalLinesByPeriod,
  groupJournalLinesByAccount,
  sumJournalLineAmounts,
  buildAccountBalanceForReport,
} from "../utils/balanceComputation.util.js";

/**
 * Ledger Report Service
 * Provides detailed transaction history and running balance for an account
 * Shows opening balance, each transaction, and closing balance
 */

/**
 * Get ledger report for a single account
 * @param {string} accountId - The account ID to report on
 * @param {string} companyId - Company context
 * @param {Date} startDate - Report period start (for transaction filtering)
 * @param {Date} endDate - Report period end (for transaction filtering)
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Ledger report with account info and transactions
 */
export const getLedgerReport = async (accountId, companyId, startDate, endDate, options = {}) => {
  const {
    reverseOrder = false, // Show oldest to newest (default) or newest to oldest
    includePertyDetails = false,
  } = options;

  if (!accountId || !companyId) {
    throw new AppError("Account ID and Company ID are required", 400, "getLedgerReport");
  }

  // Get account master
  const Account = await getAccountModel();
  const account = await Account.findById(accountId).lean();

  if (!account) {
    throw new AppError("Account not found", 404, "getLedgerReport");
  }

  if (account.companyId.toString() !== companyId) {
    throw new AppError("Account does not belong to this company", 403, "getLedgerReport");
  }

  // Get journal lines for this account in the period
  const Journal = await getJournalModel();
  const journalFilter = {
    companyId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };
  const journals = await Journal.find(journalFilter)
    .select("number date status voucherType approvalStatus sourceType referenceNumber externalDocNo narration partyName")
    .lean();
  const journalIds = journals.map((journal) => journal._id);
  const journalMap = new Map(journals.map((journal) => [journal._id.toString(), journal]));

  const JournalLine = await getJournalLineModel();
  const journalLines = await JournalLine.find({
    accountId,
    companyId,
    journalId: { $in: journalIds },
  }).lean();

  // Sort journal lines chronologically
  const sortedLines = journalLines
    .map((line) => ({
      ...line,
      journal: journalMap.get(line.journalId?.toString()) || null,
    }))
    .filter((line) => line.journal)
    .sort((a, b) => new Date(a.journal.date) - new Date(b.journal.date));

  if (reverseOrder) {
    sortedLines.reverse();
  }

  // Build ledger transactions with running balance
  let runningBalance = account.openingBalance || 0;
  const transactions = [];

  for (const line of sortedLines) {
    const debit = line.debitAmount || 0;
    const credit = line.creditAmount || 0;

    // Compute running balance based on account's normal balance
    if (`${account.openingType}`.toLowerCase() === "debit") {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }

    transactions.push({
      journalDate: line.journal.date,
      voucherType: line.journal.voucherType,
      journalNumber: line.journal.number,
      reference: line.journal.referenceNumber || line.journal.externalDocNo || "",
      narration: line.journal.narration || line.description || "",
      debit: debit > 0 ? debit : 0,
      credit: credit > 0 ? credit : 0,
      runningBalance,
    });
  }

  // Compute account totals
  const { totalDebit, totalCredit } = sumJournalLineAmounts(journalLines, "debitAmount", "creditAmount");

  const closingBalance = `${account.openingType}`.toLowerCase() === "debit"
    ? account.openingBalance + (totalDebit - totalCredit)
    : account.openingBalance + (totalCredit - totalDebit);

  const report = {
    account: {
      accountId: account._id,
      accountCode: account.code,
      accountName: account.name,
      groupName: account.groupName,
      nature: "Asset", // Would need to join group to get this properly
      normalBalance: `${account.openingType}`.toLowerCase() === "credit" ? "Credit" : "Debit",
    },
    period: {
      startDate,
      endDate,
    },
    summary: {
      openingBalance: account.openingBalance || 0,
      totalDebit,
      totalCredit,
      closingBalance,
    },
    transactions,
    transactionCount: transactions.length,
  };

  if (includePertyDetails && (account.linkedClientId || account.linkedVendorId)) {
    report.party = {
      type: account.linkedPartyType,
      name: account.partyName,
      code: account.partyCode,
      linkedId: account.linkedClientId || account.linkedVendorId,
    };
  }

  return report;
};

/**
 * Get ledger for multiple accounts
 * Used for general ledger reports
 * @param {Array<string>} accountIds - Array of account IDs
 * @param {string} companyId - Company context
 * @param {Date} startDate - Report period start
 * @param {Date} endDate - Report period end
 * @returns {Promise<Array>} Array of ledger reports
 */
export const getGeneralLedger = async (accountIds = [], companyId, startDate, endDate) => {
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    throw new AppError("Account IDs array is required", 400, "getGeneralLedger");
  }

  const ledgers = [];

  for (const accountId of accountIds) {
    try {
      const ledger = await getLedgerReport(accountId, companyId, startDate, endDate);
      ledgers.push(ledger);
    } catch (error) {
      console.error(`Error generating ledger for account ${accountId}:`, error.message);
      // Continue with next account
    }
  }

  return ledgers;
};

/**
 * Get party-wise ledger (client or vendor specific)
 * Shows all transactions for a specific client or vendor across their linked accounts
 * @param {string} partyId - Client or Vendor ID
 * @param {string} partyType - "client" or "vendor"
 * @param {string} companyId - Company context
 * @param {Date} startDate - Report period start
 * @param {Date} endDate - Report period end
 * @returns {Promise<Array>} Ledger for all accounts linked to this party
 */
export const getPartyWiseLedger = async (partyId, partyType, companyId, startDate, endDate) => {
  const Account = await getAccountModel();

  const query = { companyId };
  if (partyType === "client") {
    query.linkedClientId = partyId;
  } else if (partyType === "vendor") {
    query.linkedVendorId = partyId;
  } else {
    throw new AppError("Invalid party type. Use 'client' or 'vendor'", 400, "getPartyWiseLedger");
  }

  const accounts = await Account.find(query).lean();

  if (accounts.length === 0) {
    throw new AppError("No accounts found for this party", 404, "getPartyWiseLedger");
  }

  const ledgers = [];
  for (const account of accounts) {
    const ledger = await getLedgerReport(account._id, companyId, startDate, endDate);
    ledgers.push(ledger);
  }

  return ledgers;
};

/**
 * Get ledger with filter options
 * Advanced ledger query with multiple filters
 * @param {Object} filters - Filter criteria
 * @param {string} filters.accountId - Account ID
 * @param {string} filters.companyId - Company ID
 * @param {string} filters.groupName - Group name filter
 * @param {string} filters.scheduleLineItem - Schedule line item filter
 * @param {Date} filters.startDate - Period start
 * @param {Date} filters.endDate - Period end
 * @returns {Promise<Array>} Filtered ledger reports
 */
export const getLedgerWithFilters = async (filters) => {
  const { accountId, companyId, groupName, scheduleLineItem, startDate, endDate } = filters;

  if (!companyId) {
    throw new AppError("Company ID is required", 400, "getLedgerWithFilters");
  }

  const Account = await getAccountModel();
  const query = { companyId };

  if (accountId) {
    query._id = accountId;
  }
  if (groupName) {
    query.groupName = groupName;
  }
  if (scheduleLineItem) {
    query["scheduleMapping.scheduleLineItem"] = scheduleLineItem;
  }

  const accounts = await Account.find(query).lean();

  if (accounts.length === 0) {
    return [];
  }

  const ledgers = [];
  for (const account of accounts) {
    try {
      const ledger = await getLedgerReport(account._id, companyId, startDate, endDate);
      ledgers.push(ledger);
    } catch (error) {
      console.error(`Error generating ledger for account ${account._id}:`, error.message);
    }
  }

  return ledgers;
};

export default {
  getLedgerReport,
  getGeneralLedger,
  getPartyWiseLedger,
  getLedgerWithFilters,
};
