import AppError from "../../../utils/AppError.js";
import { getAccountModel } from "../models/Account.js";
import { getJournalLineModel } from "../models/JournalLine.js";
import {
  aggregateAccountBalances,
  buildAccountBalanceForReport,
  isTrialBalanced,
  sumJournalLineAmounts,
} from "../utils/balanceComputation.util.js";

/**
 * Trial Balance Report Service
 * Generates the Trial Balance showing all accounts with their debit/credit balances
 * Trial Balance is the foundation for all financial statements
 * Validates that Total Debits = Total Credits
 */

/**
 * Generate trial balance for a company at a specific date
 * @param {string} companyId - Company ID
 * @param {Date} asOfDate - The date to compute trial balance as of
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Trial balance report with all accounts and totals
 */
export const getTrialBalance = async (companyId, asOfDate, options = {}) => {
  const {
    groupByScheduleHead = true,
    groupByNature = false,
    includeZeroBalance = false,
    includeInactive = false,
  } = options;

  if (!companyId) {
    throw new AppError("Company ID is required", 400, "getTrialBalance");
  }

  if (!asOfDate) {
    throw new AppError("As of date is required", 400, "getTrialBalance");
  }

  const dateAsOf = new Date(asOfDate);

  // Get all active accounts for the company
  const Account = await getAccountModel();
  const accountQuery = { companyId };
  if (!includeInactive) {
    accountQuery.isActive = true;
  }

  const accounts = await Account.find(accountQuery).lean();

  if (accounts.length === 0) {
    throw new AppError("No accounts found for this company", 404, "getTrialBalance");
  }

  // Get all journals up to the as-of date
  const Journal = await (await import("../models/Journal.js")).getJournalModel();
  const validJournals = await Journal.find({
    date: { $lte: dateAsOf },
    companyId,
    status: { $in: ["Posted", "Approved"] } // optionally restrict to posted
  })
    .select("_id date number voucherType sourceType referenceNumber partyName externalDocNo createdAt")
    .lean();

  const journalIds = validJournals.map(j => j._id);
  const journalsMap = new Map(validJournals.map(j => [j._id.toString(), j]));

  // Get all journal lines up to the as-of date
  const JournalLine = await getJournalLineModel();
  const rawJournalLines = await JournalLine.find({
    journalId: { $in: journalIds },
    companyId
  }).lean();

  // Attach journal reference to lines for uniform handling if needed
  const journalLines = rawJournalLines.map(line => ({
    ...line,
    journalId: journalsMap.get(line.journalId?.toString())
  }));

  // Group journal lines by account
  const linesByAccount = new Map();
  for (const line of journalLines) {
    const accountId = line.accountId.toString();
    if (!linesByAccount.has(accountId)) {
      linesByAccount.set(accountId, []);
    }
    linesByAccount.get(accountId).push(line);
  }

  // Build balance record for each account
  const accountBalances = [];

  for (const account of accounts) {
    const accountId = account._id.toString();
    const lines = linesByAccount.get(accountId) || [];

    const { totalDebit, totalCredit } = sumJournalLineAmounts(lines, "debitAmount", "creditAmount");

    const balanceRecord = buildAccountBalanceForReport(
      account,
      0, // Pre-opening (assuming opening balance is in account.openingBalance)
      0,
      totalDebit,
      totalCredit
    );

    // Include opening balance in computation
    balanceRecord.openingBalance = account.openingBalance || 0;
    balanceRecord.closingBalance = account.openingBalance + (totalDebit - totalCredit);

    if (account.openingType === "Credit") {
      balanceRecord.closingBalance = account.openingBalance + (totalCredit - totalDebit);
    }

    // Re-split with updated closing balance
    if (balanceRecord.closingBalance > 0) {
      if (account.openingType === "Debit") {
        balanceRecord.closingDebit = balanceRecord.closingBalance;
        balanceRecord.closingCredit = 0;
      } else {
        balanceRecord.closingDebit = 0;
        balanceRecord.closingCredit = balanceRecord.closingBalance;
      }
    } else if (balanceRecord.closingBalance < 0) {
      if (account.openingType === "Debit") {
        balanceRecord.closingDebit = 0;
        balanceRecord.closingCredit = Math.abs(balanceRecord.closingBalance);
      } else {
        balanceRecord.closingDebit = Math.abs(balanceRecord.closingBalance);
        balanceRecord.closingCredit = 0;
      }
    } else {
      balanceRecord.closingDebit = 0;
      balanceRecord.closingCredit = 0;
    }

    // Filter zero balances if requested
    if (!includeZeroBalance && balanceRecord.closingBalance === 0) {
      continue;
    }

    accountBalances.push(balanceRecord);
  }

  // Aggregate balances
  const aggregation = aggregateAccountBalances(accountBalances, {
    groupByScheduleHead,
    groupByNature,
    includeZeroBalance,
  });

  const isBalanced = isTrialBalanced(aggregation);

  // Add balance check
  if (!isBalanced) {
    console.warn(`Trial Balance NOT BALANCED for company ${companyId}. Diff: ${Math.abs(aggregation.totalDebit - aggregation.totalCredit)}`);
  }

  const report = {
    companyId,
    asOfDate: dateAsOf,
    accountCount: accountBalances.length,
    isBalanced,
    tolerance: 0.01,
    totalDebit: aggregation.totalDebit,
    totalCredit: aggregation.totalCredit,
    difference: aggregation.totalDebit - aggregation.totalCredit,
    accounts: aggregation.accounts.sort((a, b) => (a.accountCode || "").localeCompare(b.accountCode || "")),
    summary: {
      byScheduleHead: aggregation.groups || {},
    },
  };

  return report;
};

/**
 * Get trial balance for a specific period
 * Shows movement within period separately
 * @param {string} companyId - Company ID
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Trial balance with period breakdown
 */
export const getTrialBalanceForPeriod = async (companyId, startDate, endDate, options = {}) => {
  if (!companyId || !startDate || !endDate) {
    throw new AppError("Company ID, start date, and end date are required", 400, "getTrialBalanceForPeriod");
  }

  const dateStart = new Date(startDate);
  const dateEnd = new Date(endDate);
  const dateBeforeStart = new Date(dateStart);
  dateBeforeStart.setFullYear(dateBeforeStart.getFullYear() - 100); // Get all opening balances

  // Get opening balance as of day before period start
  const openingTrialBalance = await getTrialBalance(companyId, new Date(dateStart.getTime() - 86400000), options);

  // Get closing balance as of end of period
  const closingTrialBalance = await getTrialBalance(companyId, dateEnd, options);

  // Compute period movements (closing - opening)
  const accountMovements = new Map();
  for (const account of openingTrialBalance.accounts) {
    accountMovements.set(account.accountId.toString(), {
      openingDebit: account.closingDebit || 0,
      openingCredit: account.closingCredit || 0,
    });
  }

  const report = {
    companyId,
    period: {
      startDate: dateStart,
      endDate: dateEnd,
    },
    opening: {
      totalDebit: openingTrialBalance.totalDebit,
      totalCredit: openingTrialBalance.totalCredit,
      isBalanced: openingTrialBalance.isBalanced,
    },
    closing: {
      totalDebit: closingTrialBalance.totalDebit,
      totalCredit: closingTrialBalance.totalCredit,
      isBalanced: closingTrialBalance.isBalanced,
    },
    accounts: closingTrialBalance.accounts.map((account) => {
      const opening = accountMovements.get(account.accountId.toString()) || { openingDebit: 0, openingCredit: 0 };
      return {
        ...account,
        openingDebit: opening.openingDebit,
        openingCredit: opening.openingCredit,
        periodDebit: (account.closingDebit || 0) - (opening.openingDebit || 0),
        periodCredit: (account.closingCredit || 0) - (opening.openingCredit || 0),
      };
    }),
  };

  return report;
};

/**
 * Validate trial balance (debits = credits)
 * Useful for debugging unbalanced accounting
 * @param {string} companyId - Company ID
 * @param {Date} asOfDate - Date to validate
 * @returns {Promise<Object>} Validation result
 */
export const validateTrialBalance = async (companyId, asOfDate) => {
  const trialBalance = await getTrialBalance(companyId, asOfDate);

  return {
    companyId,
    asOfDate,
    isValid: trialBalance.isBalanced,
    totalDebit: trialBalance.totalDebit,
    totalCredit: trialBalance.totalCredit,
    difference: trialBalance.difference,
    excessOnDebit: trialBalance.difference > 0 ? trialBalance.difference : 0,
    excessOnCredit: trialBalance.difference < 0 ? Math.abs(trialBalance.difference) : 0,
    accountsWithError: trialBalance.difference !== 0 ? trialBalance.accounts : [],
  };
};

/**
 * Get trial balance summary by schedule head
 * Shows P&L vs Balance Sheet breakdown
 * @param {string} companyId - Company ID
 * @param {Date} asOfDate - Date to compute for
 * @returns {Promise<Object>} Summary by schedule head
 */
export const getTrialBalanceSummary = async (companyId, asOfDate) => {
  const trialBalance = await getTrialBalance(companyId, asOfDate, { groupByScheduleHead: true });

  const summary = {
    companyId,
    asOfDate,
    byScheduleHead: {},
    grand: {
      totalDebit: trialBalance.totalDebit,
      totalCredit: trialBalance.totalCredit,
      isBalanced: trialBalance.isBalanced,
    },
  };

  for (const [headName, group] of Object.entries(trialBalance.summary.byScheduleHead)) {
    summary.byScheduleHead[headName] = {
      totalDebit: group.totalDebit,
      totalCredit: group.totalCredit,
      accountCount: group.accounts.length,
    };
  }

  return summary;
};

export default {
  getTrialBalance,
  getTrialBalanceForPeriod,
  validateTrialBalance,
  getTrialBalanceSummary,
};
