import AppError from "../../../utils/AppError.js";

/**
 * Schedule III Configuration for Group classification
 * Based on Indian Company Law financial reporting standards
 */
export const SCHEDULE_III_CONFIG = {
  Asset: {
    scheduleMainHead: "Assets",
    balanceType: "Debit",
    accountType: "balanceSheet",
    groups: {
      "Non-Current Assets": [
        "Property, Plant and Equipment",
        "Intangible Assets",
        "Capital Work-in-Progress",
        "Non-Current Investments",
        "Deferred Tax Assets (Net)",
        "Long-Term Loans and Advances",
        "Other Non-Current Assets",
      ],
      "Current Assets": [
        "Current Investments",
        "Inventories",
        "Trade Receivables",
        "Cash and Cash Equivalents",
        "Short-Term Loans and Advances",
        "Other Current Assets",
      ],
    },
  },
  Liability: {
    scheduleMainHead: "Equity and Liabilities",
    balanceType: "Credit",
    accountType: "balanceSheet",
    groups: {
      "Non-Current Liabilities": [
        "Long-Term Borrowings",
        "Deferred Tax Liabilities (Net)",
        "Other Long-Term Liabilities",
        "Long-Term Provisions",
      ],
      "Current Liabilities": [
        "Short-Term Borrowings",
        "Trade Payables",
        "Other Current Liabilities",
        "Short-Term Provisions",
      ],
    },
  },
  Equity: {
    scheduleMainHead: "Equity and Liabilities",
    balanceType: "Credit",
    accountType: "balanceSheet",
    groups: {
      "Shareholders' Funds": [
        "Share Capital",
        "Reserves and Surplus",
        "Money Received Against Share Warrants",
      ],
      "Share Application Money Pending Allotment": [
        "Share Application Money Pending Allotment",
      ],
    },
  },
  Income: {
    scheduleMainHead: "P&L",
    balanceType: "Credit",
    accountType: "revenueAccount",
    groups: {
      Revenue: [
        "Revenue from Operations",
        "Other Income",
      ],
    },
  },
  Expense: {
    scheduleMainHead: "P&L",
    balanceType: "Debit",
    accountType: "revenueAccount",
    groups: {
      Expenses: [
        "Cost of Materials Consumed",
        "Purchase of Stock-in-Trade",
        "Changes in Inventories",
        "Employee Benefits Expense",
        "Finance Costs",
        "Depreciation and Amortization Expense",
        "Other Expenses",
      ],
    },
  },
};

/**
 * Get schedule options for a given nature
 * @param {string} nature - Asset, Liability, Equity, Income, or Expense
 * @returns {Object|null} Schedule options including main head and groups
 */
export const getScheduleOptionsForNature = (nature) => {
  const config = SCHEDULE_III_CONFIG[nature];
  if (!config) return null;
  return {
    scheduleMainHead: config.scheduleMainHead,
    groups: Object.entries(config.groups).map(([groupName, lineItems]) => ({
      name: groupName,
      lineItems,
    })),
  };
};

/**
 * Get default schedule line item based on group/account name
 * Uses intelligent pattern matching to auto-classify accounts
 * @param {string} groupName - The group or account name
 * @param {string} nature - The nature of the account
 * @returns {string|null} The matched schedule line item
 */
export const getDefaultScheduleLineItemForGroupName = (groupName = "", nature = "") => {
  const normalized = `${groupName}`.trim().toLowerCase();
  const config = SCHEDULE_III_CONFIG[nature];
  if (!config) return null;

  const mappings = [
    { regex: /\b(sundry debtors|trade receivable|debtors|accounts receivable)\b/i, lineItem: "Trade Receivables" },
    { regex: /\b(cash|bank|cash at bank|cash in hand|petty cash)\b/i, lineItem: "Cash and Cash Equivalents" },
    { regex: /\b(sundry creditors|trade payable|creditors|accounts payable)\b/i, lineItem: "Trade Payables" },
    { regex: /\b(stock|inventory|inventories)\b/i, lineItem: "Inventories" },
    { regex: /\b(capital|share capital)\b/i, lineItem: "Share Capital" },
    { regex: /\b(reserve|surplus|retained earning|current year profit|current year loss)\b/i, lineItem: "Reserves and Surplus" },
    { regex: /\b(sales|revenue|turnover)\b/i, lineItem: "Revenue from Operations" },
    { regex: /\b(finance|interest|bank charges?)\b/i, lineItem: "Finance Costs" },
    { regex: /\b(depreciation|amorti)\b/i, lineItem: "Depreciation and Amortization Expense" },
    { regex: /\b(salary|wages?|staff|employee|payroll)\b/i, lineItem: "Employee Benefits Expense" },
    { regex: /\b(purchase|procurement)\b/i, lineItem: "Purchase of Stock-in-Trade" },
    { regex: /\b(ppe|property|plant|equipment|asset)\b/i, lineItem: "Property, Plant and Equipment" },
    { regex: /\b(investment|securities)\b/i, lineItem: "Current Investments" },
    { regex: /\b(loan|borrowing|credit|debenture)\b/i, lineItem: "Short-Term Borrowings" },
  ];

  const match = mappings.find((entry) => entry.regex.test(normalized));
  if (!match) return null;

  for (const lineItems of Object.values(config.groups)) {
    if (lineItems.includes(match.lineItem)) {
      return match.lineItem;
    }
  }

  return null;
};

/**
 * Find the schedule group (e.g. "Current Assets", "Non-Current Liabilities") for a line item
 * @param {string} nature - The nature of the account
 * @param {string} scheduleLineItem - The line item to find the group for
 * @returns {string|null} The schedule group name
 */
export const findScheduleGroupForLineItem = (nature, scheduleLineItem) => {
  const config = SCHEDULE_III_CONFIG[nature];
  if (!config || !scheduleLineItem) return null;

  for (const [groupName, lineItems] of Object.entries(config.groups)) {
    if (lineItems.includes(scheduleLineItem)) {
      return groupName;
    }
  }
  return null;
};

/**
 * Validate group schedule mapping for consistency
 * Ensures that the balance type and schedule head match the nature
 * @param {Object} mapping - The mapping to validate
 * @param {string} mapping.nature - Asset, Liability, etc.
 * @param {string} mapping.scheduleMainHead - Assets, Equity and Liabilities, P&L
 * @param {string} mapping.scheduleGroup - Current/Non-Current, etc.
 * @param {string} mapping.scheduleLineItem - Revenue from Operations, etc.
 * @param {string} mapping.balanceType - Debit or Credit
 * @param {Object} options - Validation options
 * @param {boolean} options.partial - If true, allows partial validation (for updates)
 * @returns {boolean} True if valid
 * @throws {AppError} If validation fails
 */
export const validateGroupScheduleMapping = ({
  nature,
  scheduleMainHead,
  scheduleGroup,
  scheduleLineItem,
  balanceType,
}, { partial = false } = {}) => {
  const config = SCHEDULE_III_CONFIG[nature];
  if (!config) {
    throw new AppError("Invalid group nature", 400, "validateGroupScheduleMapping");
  }

  if (!partial || balanceType !== undefined) {
    if (!balanceType) {
      throw new AppError("balanceType is required", 400, "validateGroupScheduleMapping");
    }
    if (balanceType !== config.balanceType) {
      throw new AppError(
        `For ${nature}, balanceType must be "${config.balanceType}"`,
        400,
        "validateGroupScheduleMapping"
      );
    }
  }

  if (!partial || scheduleMainHead !== undefined) {
    if (!scheduleMainHead) {
      throw new AppError("scheduleMainHead is required", 400, "validateGroupScheduleMapping");
    }
    if (scheduleMainHead !== config.scheduleMainHead) {
      throw new AppError(
        `For ${nature}, scheduleMainHead must be "${config.scheduleMainHead}"`,
        400,
        "validateGroupScheduleMapping"
      );
    }
  }

  if (!partial || scheduleGroup !== undefined) {
    if (!scheduleGroup) {
      throw new AppError("scheduleGroup is required", 400, "validateGroupScheduleMapping");
    }
    if (!Object.keys(config.groups).includes(scheduleGroup)) {
      throw new AppError(
        `Invalid scheduleGroup "${scheduleGroup}" for nature ${nature}`,
        400,
        "validateGroupScheduleMapping"
      );
    }
  }

  if (!partial || scheduleLineItem !== undefined) {
    if (!scheduleLineItem) {
      throw new AppError("scheduleLineItem is required", 400, "validateGroupScheduleMapping");
    }
    const validLineItems = config.groups[scheduleGroup] || [];
    if (!validLineItems.includes(scheduleLineItem)) {
      throw new AppError(
        `Invalid scheduleLineItem "${scheduleLineItem}" for group "${scheduleGroup}"`,
        400,
        "validateGroupScheduleMapping"
      );
    }
  }

  return true;
};

export const deriveLedgerPropertiesFromGroup = (group) => {
  if (!group?.nature) {
    throw new AppError("Group nature is required for ledger classification", 400, "deriveLedgerPropertiesFromGroup");
  }

  validateGroupScheduleMapping({
    nature: group.nature,
    balanceType: group.balanceType,
    scheduleMainHead: group.scheduleMainHead,
    scheduleGroup: group.scheduleGroup,
    scheduleLineItem: group.scheduleLineItem,
  });

  const config = SCHEDULE_III_CONFIG[group.nature];
  const isBalanceSheet = config.accountType === "balanceSheet";

  let subType;
  if (isBalanceSheet) {
    subType = /non-current/i.test(group.scheduleGroup) ? "nonCurrent" : "current";
    if (group.nature === "Equity") {
      subType = "nonCurrent";
    }
  }

  return {
    type: config.accountType,
    openingType: config.balanceType.toLowerCase(),
    subType: isBalanceSheet ? subType : undefined,
    scheduleMapping: {
      reportType: config.accountType === "balanceSheet" ? "balance_sheet" : "profit_and_loss",
      primaryHead: group.scheduleMainHead,
      subHead: group.scheduleGroup,
      lineItemCode: group.scheduleLineItem,
      lineItemName: group.scheduleLineItem,
      noteNo: group.noteNo || null,
    },
  };
};

export default SCHEDULE_III_CONFIG;
