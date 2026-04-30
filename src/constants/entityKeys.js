/**
 * Centralized Entity Keys used throughout the application
 * These must match the keys defined in initializeEntities.js
 * Use these constants to prevent typos and ensure consistency
 */

export const ENTITY_KEYS = {
  // Root/Parent Entities
  DASHBOARD: "DASHBOARD",
  ACCOUNTS: "ACCOUNTS", // Parent for accounting module
  MASTER_CONTROL: "MASTER CONTROL", // Parent for master data
  INVOICE: "INVOICE", // Parent for invoicing
  PURCHASE_ORDER: "PURCHASE_ORDER", // Parent for purchase orders

  // Accounting Module Entities
  JOURNAL: "JOURNAL",
  GROUPS: "GROUPS",
  TRIAL_BALANCE: "TRIAL BALANCE",
  PROFIT_AND_LOSS: "PROFIT AND LOSS",
  BALANCE_SHEET: "BALANCE SHEET",
  DAY_BOOK: "DAY BOOK",
  CHART_OF_ACCOUNTS: "CHART OF ACCOUNTS",
  ACCOUNT_TYPE: "ACCOUNT_TYPE",

  // Master Control Module Entities
  CLIENTS: "CLIENTS",
  VENDOR: "VENDOR",
  HSN: "HSN",

  // Payment Entity
  PAYMENT: "PAYMENT",

  // Special/Child Entities
  CONTRA: "CONTRA",
};

/**
 * Standard Permission Actions
 * These are the allowed actions that can be assigned to users for entities
 */
export const PERMISSION_ACTIONS = {
  CREATE: "CREATE",
  VIEW: "VIEW",
  EDIT: "EDIT",
  DELETE: "DELETE",
};

/**
 * Helper function to validate entity key
 */
export const isValidEntityKey = (key) => {
  return Object.values(ENTITY_KEYS).includes(key);
};

/**
 * Helper function to validate permission action
 */
export const isValidAction = (action) => {
  return Object.values(PERMISSION_ACTIONS).includes(action);
};

/**
 * Get human-readable name for entity key
 */
export const getEntityDisplayName = (entityKey) => {
  const displayNames = {
    [ENTITY_KEYS.DASHBOARD]: "Dashboard",
    [ENTITY_KEYS.ACCOUNTS]: "Accounting",
    [ENTITY_KEYS.MASTER_CONTROL]: "Master Control",
    [ENTITY_KEYS.INVOICE]: "Invoices",
    [ENTITY_KEYS.PURCHASE_ORDER]: "Purchase Orders",
    [ENTITY_KEYS.JOURNAL]: "Journal",
    [ENTITY_KEYS.GROUPS]: "Groups",
    [ENTITY_KEYS.TRIAL_BALANCE]: "Trial Balance",
    [ENTITY_KEYS.PROFIT_AND_LOSS]: "Profit & Loss",
    [ENTITY_KEYS.BALANCE_SHEET]: "Balance Sheet",
    [ENTITY_KEYS.DAY_BOOK]: "Day Book",
    [ENTITY_KEYS.CHART_OF_ACCOUNTS]: "Chart of Accounts",
    [ENTITY_KEYS.ACCOUNT_TYPE]: "Account Type",
    [ENTITY_KEYS.CLIENTS]: "Clients",
    [ENTITY_KEYS.VENDOR]: "Vendors",
    [ENTITY_KEYS.HSN]: "HSN/SAC Codes",
    [ENTITY_KEYS.PAYMENT]: "Payment",
    [ENTITY_KEYS.CONTRA]: "Contra",
  };
  return displayNames[entityKey] || entityKey;
};
