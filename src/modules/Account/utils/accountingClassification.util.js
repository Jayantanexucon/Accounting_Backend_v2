import { SCHEDULE_III_CONFIG, getDefaultScheduleLineItemForGroupName, findScheduleGroupForLineItem } from "./scheduleIIIConfig.js";
import AppError from "../../../utils/AppError.js";

/**
 * Derive account properties and classification from group master
 * Used when creating or updating accounts to inherit group characteristics
 * @param {Object} group - The group master record
 * @returns {Object} Derived properties for the account
 * @throws {AppError} If group nature is invalid
 */
export const deriveLedgerPropertiesFromGroup = (group) => {
  if (!group?.nature) {
    throw new AppError("Group nature is required for ledger classification", 400, "deriveLedgerPropertiesFromGroup");
  }

  const config = SCHEDULE_III_CONFIG[group.nature];
  if (!config) {
    throw new AppError(`Invalid nature: ${group.nature}`, 400, "deriveLedgerPropertiesFromGroup");
  }

  return {
    type: config.accountType,
    scheduleMapping: {
      scheduleMainHead: group.scheduleMainHead || config.scheduleMainHead,
      scheduleGroup: group.scheduleGroup,
      scheduleLineItem: group.scheduleLineItem,
      reportType: group.scheduleMainHead === "P&L" ? "profit_and_loss" : "balance_sheet",
    },
    openingType: config.balanceType, // Debit or Credit
  };
};

/**
 * Determine if an account should be classified as Current or Non-Current
 * Used for balance sheet presentation
 * @param {string} scheduleGroup - The schedule group (e.g., "Current Assets")
 * @returns {string|null} "current" or "nonCurrent"
 */
export const deriveSubTypeFromScheduleGroup = (scheduleGroup = "") => {
  const normalized = scheduleGroup.toLowerCase();
  if (normalized.includes("current")) {
    return "current";
  } else if (normalized.includes("non-current")) {
    return "nonCurrent";
  }
  return null;
};

/**
 * Get account type based on nature
 * @param {string} nature - Asset, Liability, Equity, Income, or Expense
 * @returns {string} "balanceSheet" or "revenueAccount"
 */
export const getAccountTypeForNature = (nature) => {
  const config = SCHEDULE_III_CONFIG[nature];
  return config?.accountType || null;
};

/**
 * Get normal balance (Debit/Credit) for an account based on its nature
 * @param {string} nature - Asset, Liability, Equity, Income, or Expense
 * @returns {string} "Debit" or "Credit"
 */
export const getNormalBalanceForNature = (nature) => {
  const config = SCHEDULE_III_CONFIG[nature];
  return config?.balanceType || null;
};

/**
 * Classify an account for reporting based on its properties
 * @param {Object} account - Account object with nature, type, etc.
 * @returns {Object} Classification info
 */
export const classifyAccountForReporting = (account) => {
  const {
    type,
    groupName,
    scheduleMapping,
    linkedClientId,
    linkedVendorId,
    openingType,
  } = account;

  return {
    isBalanceSheetAccount: type === "balanceSheet",
    isIncomeExpenseAccount: type === "revenueAccount",
    reportMainHead: scheduleMapping?.scheduleMainHead,
    reportType: scheduleMapping?.reportType,
    reportLineItem: scheduleMapping?.scheduleLineItem,
    isLinkedLedger: !!(linkedClientId || linkedVendorId),
    normalBalance: openingType,
    groupText: groupName,
  };
};

/**
 * Determine report presentation order
 * Assets and Liabilities are typically presented in flow order on balance sheet
 * @param {string} scheduleMainHead - Assets, Equity and Liabilities, P&L
 * @returns {number} Order index for sorting
 */
export const getReportPresentationOrder = (scheduleMainHead) => {
  const order = {
    "Assets": 1,
    "Equity and Liabilities": 2,
    "P&L": 3,
  };
  return order[scheduleMainHead] || 999;
};

/**
 * Validate account classification consistency
 * @param {Object} account - Account object
 * @param {Object} group - Associated group object
 * @throws {AppError} If classification is inconsistent
 */
export const validateAccountClassification = (account, group) => {
  if (!account || !group) {
    throw new AppError("Account and group are required for classification validation", 400, "validateAccountClassification");
  }

  // Verify group nature is valid
  if (!SCHEDULE_III_CONFIG[group.nature]) {
    throw new AppError(`Invalid group nature: ${group.nature}`, 400, "validateAccountClassification");
  }

  // Verify account type matches group
  const expectedType = SCHEDULE_III_CONFIG[group.nature].accountType;
  if (account.type !== expectedType) {
    throw new AppError(
      `Account type must be "${expectedType}" for nature "${group.nature}"`,
      400,
      "validateAccountClassification"
    );
  }

  // Verify opening type (debit/credit) matches group
  const expectedBalance = SCHEDULE_III_CONFIG[group.nature].balanceType;
  if (account.openingType !== expectedBalance) {
    throw new AppError(
      `Opening type must be "${expectedBalance}" for nature "${group.nature}"`,
      400,
      "validateAccountClassification"
    );
  }
};

/**
 * Enrich account with automatic classification if missing
 * @param {Object} account - Partial account object
 * @param {Object} group - Full group object
 * @returns {Object} Enriched account object
 */
export const enrichAccountWithGroupClassification = (account, group) => {
  const enriched = { ...account };

  // Derive account type if missing
  if (!enriched.type) {
    enriched.type = SCHEDULE_III_CONFIG[group.nature].accountType;
  }

  // Set opening type from group balance type
  if (!enriched.openingType) {
    enriched.openingType = SCHEDULE_III_CONFIG[group.nature].balanceType;
  }

  // Derive subType for balance sheet accounts
  if (enriched.type === "balanceSheet" && !enriched.subType) {
    enriched.subType = deriveSubTypeFromScheduleGroup(group.scheduleGroup);
  }

  // Copy schedule mapping from group
  if (!enriched.scheduleMapping && group.scheduleMapping) {
    enriched.scheduleMapping = { ...group.scheduleMapping };
  }

  // Set group name from group master (not the nature label)
  if (!enriched.groupName && group.name) {
    enriched.groupName = group.name;
  }

  return enriched;
};

export default {
  deriveLedgerPropertiesFromGroup,
  deriveSubTypeFromScheduleGroup,
  getAccountTypeForNature,
  getNormalBalanceForNature,
  classifyAccountForReporting,
  getReportPresentationOrder,
  validateAccountClassification,
  enrichAccountWithGroupClassification,
};
