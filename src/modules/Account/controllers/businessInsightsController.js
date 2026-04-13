import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { getJournalLineModel } from "../models/JournalLine.js";

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

const getDefaultFinancialYearRange = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    startDate: new Date(startYear, 3, 1, 0, 0, 0, 0),
    endDate: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
    financialYear: `${startYear}-${String(startYear + 1).slice(-2)}`,
  };
};

const parseFinancialYear = (financialYear) => {
  if (!financialYear) {
    return getDefaultFinancialYearRange();
  }

  const match = String(financialYear).trim().match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if (!match) {
    throw new AppError("Invalid financialYear format. Use YYYY-YY or YYYY-YYYY", 400, "parseFinancialYear");
  }

  const startYear = Number(match[1]);
  const endPart = match[2];
  const endYear = endPart.length === 2 ? Number(`${String(startYear).slice(0, 2)}${endPart}`) : Number(endPart);

  return {
    startDate: new Date(startYear, 3, 1, 0, 0, 0, 0),
    endDate: new Date(endYear, 2, 31, 23, 59, 59, 999),
    financialYear: `${startYear}-${String(endYear).slice(-2)}`,
  };
};

const resolveDateRange = ({ financialYear, fromDate, toDate, month }) => {
  if (fromDate || toDate) {
    const fyRange = parseFinancialYear(financialYear);
    return {
      startDate: fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : fyRange.startDate,
      endDate: toDate ? new Date(`${toDate}T23:59:59.999Z`) : fyRange.endDate,
      financialYear: fyRange.financialYear,
    };
  }

  const fyRange = parseFinancialYear(financialYear);
  if (!month) {
    return fyRange;
  }

  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new AppError("month must be between 1 and 12", 400, "resolveDateRange");
  }

  const startYear = fyRange.startDate.getFullYear();
  const endYear = fyRange.endDate.getFullYear();
  const calendarYear = monthNumber >= 4 ? startYear : endYear;

  return {
    startDate: new Date(calendarYear, monthNumber - 1, 1, 0, 0, 0, 0),
    endDate: new Date(calendarYear, monthNumber, 0, 23, 59, 59, 999),
    financialYear: fyRange.financialYear,
  };
};

const buildInsightsFromRows = (rows = []) => {
  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    cashBankBalance: 0,
  };

  const expenseMap = new Map();
  const monthlyMap = new Map();
  const ledgerMap = new Map();

  rows.forEach((row) => {
    const debit = toNumber(row.debitAmount);
    const credit = toNumber(row.creditAmount);
    const groupNature = row.groupNature || "Unknown";
    const ledgerKey = String(row.accountId || row.accountCode || row.accountName || Math.random());
    const monthKey = row.journalDate ? new Date(row.journalDate).toISOString().slice(0, 7) : "unknown";

    if (groupNature === "Income") {
      summary.totalIncome += credit;
    }

    if (groupNature === "Expense") {
      summary.totalExpense += debit;
      expenseMap.set(row.accountName, round2((expenseMap.get(row.accountName) || 0) + debit));
    }

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { month: monthKey, income: 0, expense: 0, profit: 0 });
    }
    const monthBucket = monthlyMap.get(monthKey);
    if (groupNature === "Income") {
      monthBucket.income = round2(monthBucket.income + credit);
    }
    if (groupNature === "Expense") {
      monthBucket.expense = round2(monthBucket.expense + debit);
    }

    if (!ledgerMap.has(ledgerKey)) {
      ledgerMap.set(ledgerKey, {
        ledgerId: row.accountId,
        ledger: row.accountName || "Unknown Ledger",
        ledgerCode: row.accountCode || "",
        group: row.groupName || "Unknown",
        groupNature,
        debit: 0,
        credit: 0,
        closingBalance: 0,
      });
    }
    const ledgerBucket = ledgerMap.get(ledgerKey);
    ledgerBucket.debit = round2(ledgerBucket.debit + debit);
    ledgerBucket.credit = round2(ledgerBucket.credit + credit);
    ledgerBucket.closingBalance = round2(ledgerBucket.debit - ledgerBucket.credit);
  });

  summary.totalIncome = round2(summary.totalIncome);
  summary.totalExpense = round2(summary.totalExpense);
  summary.netProfit = round2(summary.totalIncome - summary.totalExpense);

  const ledgerImpactSummary = Array.from(ledgerMap.values())
    .sort((a, b) => a.ledger.localeCompare(b.ledger));

  summary.cashBankBalance = round2(
    ledgerImpactSummary
      .filter((item) => {
        const name = `${item.ledger} ${item.group}`.toLowerCase();
        return item.groupNature === "Asset" && (name.includes("cash") || name.includes("bank"));
      })
      .reduce((sum, item) => sum + item.closingBalance, 0)
  );

  const expenseBreakdown = Array.from(expenseMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyPerformance = Array.from(monthlyMap.values())
    .map((item) => ({
      ...item,
      label: item.month === "unknown" ? "Unknown" : new Date(`${item.month}-01T00:00:00.000Z`).toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      profit: round2(item.income - item.expense),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    summary,
    expenseBreakdown,
    monthlyPerformance,
    ledgerImpactSummary,
  };
};

const getBusinessInsightsData = async ({ companyId, financialYear, fromDate, toDate, month }) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400, "getBusinessInsightsData");
  }

  const { startDate, endDate, financialYear: resolvedFinancialYear } = resolveDateRange({
    financialYear,
    fromDate,
    toDate,
    month,
  });

  const JournalLine = await getJournalLineModel();
  const rows = await JournalLine.aggregate([
    {
      $match: {
        companyId: String(companyId),
      },
    },
    {
      $lookup: {
        from: "journals",
        localField: "journalId",
        foreignField: "_id",
        as: "journalDoc",
      },
    },
    {
      $unwind: "$journalDoc",
    },
    {
      $match: {
        "journalDoc.companyId": String(companyId),
        "journalDoc.isDeleted": { $ne: true },
        "journalDoc.approvalStatus": "Approved",
        "journalDoc.date": { $gte: startDate, $lte: endDate },
      },
    },
    {
      $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "_id",
        as: "accountDoc",
      },
    },
    {
      $unwind: "$accountDoc",
    },
    {
      $lookup: {
        from: "groups",
        localField: "accountDoc.groupId",
        foreignField: "_id",
        as: "groupDoc",
      },
    },
    {
      $addFields: {
        groupDoc: { $first: "$groupDoc" },
      },
    },
    {
      $project: {
        accountId: "$accountDoc._id",
        accountCode: { $ifNull: ["$accountDoc.code", "$accountCode"] },
        accountName: { $ifNull: ["$accountDoc.name", "$accountName"] },
        groupName: { $ifNull: ["$groupDoc.name", "$accountDoc.groupName"] },
        groupNature: { $ifNull: ["$groupDoc.nature", "Unknown"] },
        debitAmount: 1,
        creditAmount: 1,
        journalDate: "$journalDoc.date",
      },
    },
  ]);

  return {
    ...buildInsightsFromRows(rows),
    meta: {
      financialYear: resolvedFinancialYear,
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
      source: "Accounting Module only",
    },
  };
};

export const getBusinessInsightsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { financialYear, fromDate, toDate, month } = req.query;

    const report = await getBusinessInsightsData({
      companyId,
      financialYear,
      fromDate,
      toDate,
      month,
    });

    new ApiResponse({
      statusCode: 200,
      data: {
        summary: report.summary,
        expenseBreakdown: report.expenseBreakdown,
        monthlyPerformance: report.monthlyPerformance,
        ledgerImpactSummary: report.ledgerImpactSummary,
      },
      meta: report.meta,
      message: "Business insights report generated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
