import AppError from "../../../utils/AppError.js";
import { getAccountModel } from "../models/Account.js";
import { getJournalLineModel } from "../models/JournalLine.js";
import { getJournalModel } from "../models/Journal.js";
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

  const accounts = await Account.find(accountQuery).populate("groupId").lean();

  if (accounts.length === 0) {
    throw new AppError("No accounts found for this company", 404, "getTrialBalance");
  }

  // Get all journal lines up to the as-of date
  const Journal = await getJournalModel();
  const journals = await Journal.find({
    companyId,
    date: { $lte: dateAsOf },
  })
    .select("_id")
    .lean();
  const journalIds = journals.map((journal) => journal._id);

  const JournalLine = await getJournalLineModel();
  const journalLines = await JournalLine.find({
    companyId,
    journalId: { $in: journalIds },
  }).lean();

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
      `${account.openingType}`.toLowerCase() === "debit" ? account.openingBalance || 0 : 0,
      `${account.openingType}`.toLowerCase() === "credit" ? account.openingBalance || 0 : 0,
      totalDebit,
      totalCredit
    );

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
