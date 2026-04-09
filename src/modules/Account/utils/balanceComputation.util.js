import AppError from "../../../utils/AppError.js";

const normalizeBalanceType = (value = "Debit") =>
  `${value}`.toLowerCase() === "credit" ? "Credit" : "Debit";

/**
 * Balance Computation Utility
 * Core reusable logic for computing opening, movement, and closing balances
 * Used by ledger, trial balance, and financial statement reports
 */

/**
 * Normalize balance based on normal balance type
 * Debit accounts: debits are positive, credits reduce balance
 * Credit accounts: credits are positive, debits reduce balance
 * @param {number} debitAmount - Total debit amount for period
 * @param {string} normalBalance - "Debit" or "Credit"
 * @returns {number} Net balance for the period
 */
export const computeMovement = (debitAmount, normalBalance) => {
  if (normalizeBalanceType(normalBalance) === "Debit") {
    return debitAmount || 0;
  } else {
    // Credit balance accounts: debit reduces balance
    return -(debitAmount || 0);
  }
};

/**
 * Compute account balance at a point in time
 * balance = opening + movement
 * Properly normalized based on account's normal balance type
 * @param {number} openingDebit - Opening debit amount
 * @param {number} openingCredit - Opening credit amount
 * @param {number} periodDebit - Period debit amount
 * @param {number} periodCredit - Period credit amount
 * @param {string} normalBalance - "Debit" or "Credit" (account's normal balance)
 * @returns {number} Closing balance (positive = debit side for debit accounts, credit side for credit accounts)
 */
export const computeClosingBalance = (
  openingDebit = 0,
  openingCredit = 0,
  periodDebit = 0,
  periodCredit = 0,
  normalBalance = "Debit"
) => {
  const balanceType = normalizeBalanceType(normalBalance);

  if (balanceType === "Debit") {
    // For Debit balance accounts:
    // Opening balance = debit - credit
    // Add period movements = debit - credit
    // Closing = (opening_debit - opening_credit) + (period_debit - period_credit)
    const openingBalance = openingDebit - openingCredit;
    const periodMovement = periodDebit - periodCredit;
    return openingBalance + periodMovement;
  } else {
    // For Credit balance accounts:
    // Opening balance = credit - debit
    // Add period movements = credit - debit
    // Closing = (opening_credit - opening_debit) + (period_credit - period_debit)
    const openingBalance = openingCredit - openingDebit;
    const periodMovement = periodCredit - periodDebit;
    return openingBalance + periodMovement;
  }
};

/**
 * Split balance into debit and credit side for reporting
 * Trial balance and balance sheet typically show debits and credits separately
 * @param {number} balance - The computed balance
 * @param {string} normalBalance - "Debit" or "Credit"
 * @returns {Object} { debitSide, creditSide }
 */
export const splitBalance = (balance = 0, normalBalance = "Debit") => {
  if (normalizeBalanceType(normalBalance) === "Debit") {
    return {
      debitSide: balance > 0 ? balance : 0,
      creditSide: balance < 0 ? Math.abs(balance) : 0,
    };
  } else {
    return {
      creditSide: balance > 0 ? balance : 0,
      debitSide: balance < 0 ? Math.abs(balance) : 0,
    };
  }
};

/**
 * Aggregate balances across multiple accounts
 * Used for trial balance and report totaling
 * @param {Array} accounts - Array of account balance records
 * @param {Object} options - Aggregation options
 * @returns {Object} Aggregated result with grand totals
 */
export const aggregateAccountBalances = (accounts = [], options = {}) => {
  const {
    groupByScheduleHead = false,
    groupByNature = false,
    includeZeroBalance = false,
  } = options;

  const result = {
    totalDebit: 0,
    totalCredit: 0,
    accounts: [],
    groups: {},
  };

  for (const account of accounts) {
    if (!includeZeroBalance && account.closingBalance === 0) {
      continue;
    }

    const { debitSide, creditSide } = splitBalance(account.closingBalance, account.normalBalance);

    result.totalDebit += debitSide;
    result.totalCredit += creditSide;

    account.debitSide = debitSide;
    account.creditSide = creditSide;
    result.accounts.push(account);

    // Group by schedule head if requested
    if (groupByScheduleHead && account.scheduleMainHead) {
      if (!result.groups[account.scheduleMainHead]) {
        result.groups[account.scheduleMainHead] = {
          name: account.scheduleMainHead,
          totalDebit: 0,
          totalCredit: 0,
          accounts: [],
        };
      }
      result.groups[account.scheduleMainHead].totalDebit += debitSide;
      result.groups[account.scheduleMainHead].totalCredit += creditSide;
      result.groups[account.scheduleMainHead].accounts.push(account);
    }
  }

  return result;
};

/**
 * Filter journal lines for accounting periods
 * Properly handles fiscal year / calendar year boundaries
 * @param {Array} journalLines - JournalLine records with date and amounts
 * @param {Date} startDate - Period start date
 * @param {Date} endDate - Period end date
 * @param {string} filterField - Field to filter on (default: "journalDate")
 * @returns {Array} Filtered journal lines
 */
export const filterJournalLinesByPeriod = (
  journalLines = [],
  startDate,
  endDate,
  filterField = "journalDate"
) => {
  if (!startDate || !endDate) {
    return journalLines;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return journalLines.filter((line) => {
    const lineDate = new Date(line[filterField] || line.createdAt);
    return lineDate >= start && lineDate <= end;
  });
};

/**
 * Group journal lines by account
 * @param {Array} journalLines - JournalLine records
 * @param {string} accountField - Field name for account ID (default: accountId)
 * @returns {Map} Map of accountId -> array of journal lines
 */
export const groupJournalLinesByAccount = (journalLines = [], accountField = "accountId") => {
  const grouped = new Map();

  for (const line of journalLines) {
    const accountId = line[accountField]?.toString();
    if (!accountId) continue;

    if (!grouped.has(accountId)) {
      grouped.set(accountId, []);
    }
    grouped.get(accountId).push(line);
  }

  return grouped;
};

/**
 * Sum amounts from journal lines
 * @param {Array} journalLines - JournalLine records
 * @param {string} debitField - Field name for debit amount
 * @param {string} creditField - Field name for credit amount
 * @returns {Object} { totalDebit, totalCredit }
 */
export const sumJournalLineAmounts = (
  journalLines = [],
  debitField = "debitAmount",
  creditField = "creditAmount"
) => {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of journalLines) {
    totalDebit += line[debitField] || 0;
    totalCredit += line[creditField] || 0;
  }

  return { totalDebit, totalCredit };
};

/**
 * Validate trial balance (ensure debits = credits)
 * @param {Object} aggregation - Result from aggregateAccountBalances
 * @param {number} tolerance - Rounding tolerance (default: 0.01)
 * @returns {boolean} True if balanced
 */
export const isTrialBalanced = (aggregation, tolerance = 0.01) => {
  const diff = Math.abs(aggregation.totalDebit - aggregation.totalCredit);
  return diff <= tolerance;
};

/**
 * Build account balance record for reporting
 * Combines account info with computed balances
 * @param {Object} account - Account master record
 * @param {number} openingDebit - Opening debit
 * @param {number} openingCredit - Opening credit
 * @param {number} periodDebit - Period debit
 * @param {number} periodCredit - Period credit
 * @returns {Object} Account balance record for reporting
 */
export const buildAccountBalanceForReport = (
  account,
  openingDebit = 0,
  openingCredit = 0,
  periodDebit = 0,
  periodCredit = 0
) => {
  if (!account) {
    throw new AppError("Account is required", 400, "buildAccountBalanceForReport");
  }

  const openingBalance = computeClosingBalance(openingDebit, openingCredit, 0, 0, account.openingType);

  const closingBalance = computeClosingBalance(
    openingDebit,
    openingCredit,
    periodDebit,
    periodCredit,
    account.openingType
  );

  const { debitSide, creditSide } = splitBalance(closingBalance, account.openingType);

  return {
    accountId: account._id,
    accountCode: account.code,
    accountName: account.name,
    groupName: account.groupName,
    scheduleMainHead: account.scheduleMapping?.scheduleMainHead,
    scheduleGroup: account.scheduleMapping?.scheduleGroup,
    scheduleLineItem: account.scheduleMapping?.scheduleLineItem,
    normalBalance: account.openingType,
    groupNature: account.groupId?.nature || account.groupNature || null,
    linkedClientId: account.linkedClientId,
    linkedVendorId: account.linkedVendorId,
    linkedPartyType: account.linkedPartyType,
    partyName: account.partyName,
    // Balances
    openingDebit,
    openingCredit,
    openingBalance,
    periodDebit,
    periodCredit,
    periodMovement: periodDebit - periodCredit,
    closingBalance,
    closingDebit: debitSide,
    closingCredit: creditSide,
  };
};

export default {
  computeMovement,
  computeClosingBalance,
  splitBalance,
  aggregateAccountBalances,
  filterJournalLinesByPeriod,
  groupJournalLinesByAccount,
  sumJournalLineAmounts,
  isTrialBalanced,
  buildAccountBalanceForReport,
};
