import AppError from "../../../utils/AppError.js";
import { getTrialBalance, getTrialBalanceForPeriod } from "./trialBalanceService.js";
import { SCHEDULE_III_CONFIG } from "../utils/scheduleIIIConfig.js";

/**
 * Financial Statement Service
 * Generates Profit & Loss (P&L) and Balance Sheet from Trial Balance
 * Both reports are derived by applying Schedule III mapping to trial balance accounts
 */

/**
 * Build Balance Sheet from trial balance
 * Groups accounts into Assets, Liabilities, and Equity sections
 * @param {string} companyId - Company ID
 * @param {Date} asOfDate - Date for balance sheet
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Balance sheet with assets, liability, equity sections
 */
export const getBalanceSheet = async (companyId, asOfDate, options = {}) => {
  const { includeComparativePeriod = false, priorYearDate = null } = options;

  if (!companyId) {
    throw new AppError("Company ID is required", 400, "getBalanceSheet");
  }

  // Get trial balance
  const trialBalance = await getTrialBalance(companyId, asOfDate, {
    groupByScheduleHead: true,
    includeZeroBalance: false,
  });

  // Filter and group accounts by sheet section
  const assets = [];
  const liabilities = [];
  const equity = [];

  for (const account of trialBalance.accounts) {
    if (!account.scheduleMainHead) continue;

    const accountLine = {
      accountId: account.accountId,
      code: account.accountCode,
      name: account.accountName,
      groupName: account.groupName,
      normalBalance: account.normalBalance,
      openingBalance: account.openingBalance || 0,
      linkedClientId: account.linkedClientId,
      linkedVendorId: account.linkedVendorId,
      linkedPartyType: account.linkedPartyType,
      partyName: account.partyName,
      scheduleGroup: account.scheduleGroup,
      scheduleLineItem: account.scheduleLineItem,
      amount: account.closingDebit || account.closingCredit || 0,
    };

    switch (account.scheduleMainHead) {
      case "Assets":
        assets.push(accountLine);
        break;
      case "Equity and Liabilities":
        if (account.groupNature === "Equity") {
          equity.push(accountLine);
        } else {
          liabilities.push(accountLine);
        }
        break;
      default:
        break;
    }
  }

  // Aggregate by schedule group (Current vs Non-Current)
  const groupAssets = {};
  const groupLiabilities = {};
  const groupEquity = {};

  for (const asset of assets) {
    const group = asset.scheduleGroup || "Other";
    if (!groupAssets[group]) {
      groupAssets[group] = { total: 0, items: [] };
    }
    groupAssets[group].items.push(asset);
    groupAssets[group].total += asset.amount;
  }

  for (const liability of liabilities) {
    const group = liability.scheduleGroup || "Other";
    if (!groupLiabilities[group]) {
      groupLiabilities[group] = { total: 0, items: [] };
    }
    groupLiabilities[group].items.push(liability);
    groupLiabilities[group].total += liability.amount;
  }

  for (const eq of equity) {
    const group = eq.scheduleGroup || "Shareholders' Funds";
    if (!groupEquity[group]) {
      groupEquity[group] = { total: 0, items: [] };
    }
    groupEquity[group].items.push(eq);
    groupEquity[group].total += eq.amount;
  }

  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0);

  const balanceSheet = {
    companyId,
    asOfDate,
    assets: {
      current: groupAssets["Current Assets"] || { items: [], total: 0 },
      nonCurrent: groupAssets["Non-Current Assets"] || { items: [], total: 0 },
      total: totalAssets,
    },
    liabilitiesAndEquity: {
      equity: {
        shareholders: groupEquity["Shareholders' Funds"] || { items: [], total: 0 },
        other: groupEquity["Other"] || { items: [], total: 0 },
        total: totalEquity,
      },
      liabilities: {
        current: groupLiabilities["Current Liabilities"] || { items: [], total: 0 },
        nonCurrent: groupLiabilities["Non-Current Liabilities"] || { items: [], total: 0 },
        total: totalLiabilities,
      },
      total: totalEquity + totalLiabilities,
    },
    validation: {
      assetsEqualLiabilitiesPlusEquity: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      difference: totalAssets - (totalLiabilities + totalEquity),
    },
  };

  // Add comparative period if requested
  if (includeComparativePeriod && priorYearDate) {
    const priorBalance = await getBalanceSheet(companyId, new Date(priorYearDate), { includeComparativePeriod: false });
    balanceSheet.priorYear = {
      asOfDate: priorYearDate,
      assets: priorBalance.assets,
      liabilitiesAndEquity: priorBalance.liabilitiesAndEquity,
    };
  }

  return balanceSheet;
};

/**
 * Build Profit & Loss statement from trial balance
 * Shows income and expenses for a period
 * @param {string} companyId - Company ID
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @param {Object} options - Report options
 * @returns {Promise<Object>} P&L statement with income, expense, and profit sections
 */
export const getProfitAndLoss = async (companyId, startDate, endDate, options = {}) => {
  const { includeComparativePeriod = false, priorStartDate = null, priorEndDate = null } = options;

  if (!companyId || !startDate || !endDate) {
    throw new AppError("Company ID, start date, and end date are required", 400, "getProfitAndLoss");
  }

  // Get trial balance for the period
  const tb = await getTrialBalanceForPeriod(companyId, startDate, endDate, {
    groupByScheduleHead: true,
    includeZeroBalance: false,
  });

  // Filter P&L accounts
  const revenue = [];
  const expenses = [];

  for (const account of tb.accounts) {
    if (account.scheduleMainHead !== "P&L") continue;

    const accountLine = {
      accountId: account.accountId,
      code: account.accountCode,
      name: account.accountName,
      groupName: account.groupName,
      normalBalance: account.normalBalance,
      openingBalance: account.openingBalance || 0,
      linkedClientId: account.linkedClientId,
      linkedVendorId: account.linkedVendorId,
      linkedPartyType: account.linkedPartyType,
      partyName: account.partyName,
      scheduleLineItem: account.scheduleLineItem,
      amount: account.periodDebit || account.periodCredit || 0,
      debit: account.periodDebit || 0,
      credit: account.periodCredit || 0,
    };

    // Income accounts are credit balance accounts (positive credit = income)
    // Expense accounts are debit balance accounts (positive debit = expense)
    if (account.groupNature === "Income") {
      accountLine.amount = account.periodCredit || 0;
      revenue.push(accountLine);
    } else {
      accountLine.amount = account.periodDebit || 0;
      expenses.push(accountLine);
    }
  }

  // Aggregate by schedule line item
  const groupRevenue = {};
  const groupExpenses = {};

  for (const rev of revenue) {
    const lineItem = rev.scheduleLineItem || "Other Income";
    if (!groupRevenue[lineItem]) {
      groupRevenue[lineItem] = [];
    }
    groupRevenue[lineItem].push(rev);
  }

  for (const exp of expenses) {
    const lineItem = exp.scheduleLineItem || "Other Expenses";
    if (!groupExpenses[lineItem]) {
      groupExpenses[lineItem] = [];
    }
    groupExpenses[lineItem].push(exp);
  }

  // Calculate totals
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const pnl = {
    companyId,
    period: {
      startDate,
      endDate,
    },
    revenue: {
      lineItems: groupRevenue,
      total: totalRevenue,
    },
    expenses: {
      lineItems: groupExpenses,
      total: totalExpenses,
    },
    profitAndLoss: {
      grossProfit: totalRevenue, // Can be enhanced with COGS logic
      operatingExpense: totalExpenses - (totalExpenses * 0.8), // Estimate
      netProfitBeforeTax: netProfit,
      profitAfterTax: netProfit * 0.75, // Estimated with 25% tax
    },
  };

  // Add comparative period if requested
  if (includeComparativePeriod && priorStartDate && priorEndDate) {
    const priorPnL = await getProfitAndLoss(companyId, new Date(priorStartDate), new Date(priorEndDate), {
      includeComparativePeriod: false,
    });
    pnl.priorPeriod = priorPnL;
  }

  return pnl;
};

/**
 * Get comprehensive financial statements
 * Combined Balance Sheet + P&L + Key metrics
 * @param {string} companyId - Company ID
 * @param {Date} statementDate - Statement date
 * @returns {Promise<Object>} Comprehensive financial statement
 */
export const getFinancialStatements = async (companyId, statementDate) => {
  const asOfDate = new Date(statementDate);
  const periodStart = new Date(asOfDate);
  periodStart.setMonth(0);
  periodStart.setDate(1);

  const [balanceSheet, profitAndLoss] = await Promise.all([
    getBalanceSheet(companyId, asOfDate),
    getProfitAndLoss(companyId, periodStart, asOfDate),
  ]);

  // Calculate key financial ratios
  const totalAssets = balanceSheet.assets.total;
  const totalEquity = balanceSheet.liabilitiesAndEquity.equity.total;
  const totalLiabilities = balanceSheet.liabilitiesAndEquity.liabilities.total;
  const netProfit = profitAndLoss.profitAndLoss.netProfitBeforeTax;
  const totalRevenue = profitAndLoss.revenue.total;

  const ratios = {
    debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
    returnOnAssets: totalAssets > 0 ? netProfit / totalAssets : 0,
    returnOnEquity: totalEquity > 0 ? netProfit / totalEquity : 0,
    profitMargin: totalRevenue > 0 ? netProfit / totalRevenue : 0,
    assetTurnover: totalAssets > 0 ? totalRevenue / totalAssets : 0,
  };

  return {
    companyId,
    statementDate: asOfDate,
    balanceSheet,
    profitAndLoss,
    ratios,
    notes: {
      preparedDate: new Date(),
      currency: "INR",
      standard: "Schedule III - Indian Company Law",
    },
  };
};

export default {
  getBalanceSheet,
  getProfitAndLoss,
  getFinancialStatements,
};
