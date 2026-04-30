import mongoose from "mongoose";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { getInvoiceByIdRepo, updateInvoiceRepo, getInvoicesWithTDSRepo } from "../repos/invoiceRepo.js";
import { getPaymentsByInvoiceRepo, createPaymentRepo, getDetailedTDSReportRepo } from "../../Account/repos/paymentRepo.js";
import { createJournalRepo, getJournalByIdRepo } from "../../Account/repos/journalRepo.js";
import { createMultipleJournalLinesRepo } from "../../Account/repos/journalLineRepo.js";
import { getAccountModel } from "../../Account/models/Account.js";
import { getGroupModel } from "../../Account/models/Group.js";
import {
  deriveLedgerPropertiesFromGroup,
  deriveSubTypeFromScheduleGroup,
} from "../../Account/utils/accountingClassification.util.js";

const PAYMENT_MODE_TO_LEDGER = {
  BANK_TRANSFER: {
    group: {
      name: "Bank Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Bank Account",
    prefix: "BANK",
  },
  CHEQUE: {
    group: {
      name: "Bank Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Bank Account",
    prefix: "BANK",
  },
  CASH: {
    group: {
      name: "Cash Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Cash In Hand",
    prefix: "CASH",
  },
  CREDIT_CARD: {
    group: {
      name: "Bank Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Card Settlement Account",
    prefix: "CARD",
  },
  DIGITAL_WALLET: {
    group: {
      name: "Bank Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Digital Wallet Clearing",
    prefix: "WALLET",
  },
  OTHER: {
    group: {
      name: "Bank Accounts",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Cash and Cash Equivalents",
    },
    accountName: "Payment Clearing Account",
    prefix: "CLR",
  },
};

const BANK_LEDGER_GROUP = {
  name: "Bank Accounts",
  nature: "Asset",
  balanceType: "Debit",
  scheduleMainHead: "Assets",
  scheduleGroup: "Current Assets",
  scheduleLineItem: "Cash and Cash Equivalents",
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCompanyId = (companyId) => String(companyId);

const getUserId = (req) => req.user?.id || req.user?._id?.toString() || null;

const getInvoiceClientName = (invoice) =>
  invoice?.billTo?.name?.trim() || invoice?.shipTo?.name?.trim() || "";

const generateDocumentNumber = (prefix, companyId) =>
  `${prefix}-${normalizeCompanyId(companyId).slice(-4)}-${Date.now()}`;

const roundMoney = (value = 0) => Math.round(Number(value || 0) * 100) / 100;

const getInvoiceSettlementAmount = (invoice) => {
  const total = Number(invoice.invoiceAmount || invoice.amountDue || 0);
  const tds = Number(invoice.tdsAmount || invoice.totalTDSAmount || 0);
  return total - tds;
};

const getOutstandingAmount = (invoice) => {
  return Math.max(0, getInvoiceSettlementAmount(invoice) - Number(invoice.paidAmount || 0));
};

const getTaxLedgerField = (invoice) => {
  if (invoice.taxSummary && invoice.taxSummary.length > 0) {
    return "taxAccounts"; // Now returns a map
  }
  if (Number(invoice.totalIGSTAmount || 0) > 0) return "igstAccount";
  if (Number(invoice.totalCGSTAmount || 0) > 0) return "cgstAccount";
  if (Number(invoice.totalSGSTAmount || 0) > 0) return "sgstAccount";
  return null;
};

const buildAccountCode = async (companyId, prefix) => {
  const Account = await getAccountModel();
  const safePrefix = `${prefix}`.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8) || "ACC";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = `${Date.now()}`.slice(-6);
    const candidate = `${safePrefix}-${suffix}${attempt ? `${attempt}`.padStart(2, "0") : ""}`;
    const existing = await Account.findOne({
      companyId: normalizeCompanyId(companyId),
      code: candidate,
    }).lean();

    if (!existing) return candidate;
  }

  return `${safePrefix}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};

const ensureGroup = async (companyId, groupData, userId) => {
  const Group = await getGroupModel();
  const normalizedCompanyId = normalizeCompanyId(companyId);

  let group = await Group.findOne({
    companyId: normalizedCompanyId,
    name: groupData.name,
  });

  if (!group) {
    group = await Group.create({
      ...groupData,
      companyId: normalizedCompanyId,
      createdBy: userId,
      updatedBy: userId,
      isActive: true,
    });
  }

  return group;
};

const ensureLedgerAccount = async ({
  companyId,
  groupData,
  accountName,
  searchPatterns = [],
  linkedClientId = null,
  prefix,
  userId,
  extra = {},
}) => {
  const Account = await getAccountModel();
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const group = await ensureGroup(companyId, groupData, userId);

  let account = null;
  let autoCreated = false;

  if (linkedClientId) {
    account = await Account.findOne({
      companyId: normalizedCompanyId,
      linkedClientId,
    });
  }

  if (!account && searchPatterns.length) {
    account = await Account.findOne({
      companyId: normalizedCompanyId,
      isActive: true,
      $or: searchPatterns.map((pattern) => ({
        name: { $regex: pattern, $options: "i" },
      })),
    });
  }

  if (!account) {
    account = await Account.findOne({
      companyId: normalizedCompanyId,
      name: { $regex: `^${escapeRegex(accountName)}$`, $options: "i" },
      isActive: true,
    });
  }

  if (!account) {
    const derived = deriveLedgerPropertiesFromGroup(group);
    account = await Account.create({
      code: await buildAccountCode(companyId, prefix),
      name: accountName,
      type: derived.type,
      subType:
        derived.type === "balanceSheet"
          ? deriveSubTypeFromScheduleGroup(group.scheduleGroup)
          : null,
      groupId: group._id,
      groupName: group.name,
      companyId: normalizedCompanyId,
      openingBalance: 0,
      openingType: `${derived.openingType}`.toLowerCase(),
      scheduleMapping: {
        scheduleMainHead: group.scheduleMainHead || null,
        scheduleGroup: group.scheduleGroup || null,
        scheduleLineItem: group.scheduleLineItem || null,
        noteNo: group.noteNo || null,
        reportType: derived.scheduleMapping?.reportType || null,
      },
      linkedClientId: linkedClientId || null,
      linkedPartyType: linkedClientId ? "client" : null,
      partyName: linkedClientId ? accountName : null,
      isActive: true,
      description: extra.description || "",
      createdBy: userId,
      updatedBy: userId,
      ...extra,
    });
    autoCreated = true;
  }

  return { account, group, autoCreated };
};

const isValidBankLedger = (account, group) => {
  if (!account || !group) return false;
  const schedule = account.scheduleMapping || {};
  return (
    group.nature === "Asset" &&
    group.balanceType === "Debit" &&
    group.scheduleMainHead === "Assets" &&
    group.scheduleGroup === "Current Assets" &&
    group.scheduleLineItem === "Cash and Cash Equivalents" &&
    /bank/i.test(group.name || account.groupName || "") &&
    (schedule.scheduleLineItem || group.scheduleLineItem) === "Cash and Cash Equivalents"
  );
};

const getPaymentBankLedger = async ({ companyId, bankLedgerId, userId }) => {
  const Account = await getAccountModel();
  const Group = await getGroupModel();
  const normalizedCompanyId = normalizeCompanyId(companyId);

  if (bankLedgerId) {
    const account = await Account.findOne({
      _id: bankLedgerId,
      companyId: normalizedCompanyId,
      isActive: true,
    }).lean();
    const group = account?.groupId ? await Group.findById(account.groupId).lean() : null;

    if (!isValidBankLedger(account, group)) {
      throw new AppError("Selected ledger must belong to Bank Accounts under Cash and Cash Equivalents", 400, "getPaymentBankLedger");
    }

    return { account, group, autoCreated: false };
  }

  const bankGroups = await Group.find({
    companyId: normalizedCompanyId,
    name: { $regex: "bank", $options: "i" },
    nature: "Asset",
    scheduleMainHead: "Assets",
    scheduleGroup: "Current Assets",
    scheduleLineItem: "Cash and Cash Equivalents",
  }).lean();

  if (bankGroups.length) {
    const account = await Account.findOne({
      companyId: normalizedCompanyId,
      isActive: true,
      groupId: { $in: bankGroups.map((group) => group._id) },
    }).sort({ createdAt: 1 }).lean();

    if (account) {
      const group = bankGroups.find((item) => String(item._id) === String(account.groupId));
      return { account, group, autoCreated: false };
    }
  }

  return ensureLedgerAccount({
    companyId,
    groupData: BANK_LEDGER_GROUP,
    accountName: "Bank Account",
    searchPatterns: ["^Bank Account$"],
    prefix: "BANK",
    userId,
    extra: {
      description: "Auto-created default bank ledger for payment receipts",
    },
  });
};

const getAdjustmentSource = ({ paymentMode = "", adjustmentSource = "", reference = "", notes = "" } = {}) => {
  const text = `${adjustmentSource} ${reference} ${notes} ${paymentMode}`.toLowerCase();
  if (/\b(forex|fx|foreign exchange|currency|exchange)\b/.test(text)) return "FOREX";
  if (/\b(gateway|payment gateway|card|upi|wallet|online)\b/.test(text)) return "PAYMENT_GATEWAY";
  if (["DIGITAL_WALLET", "CREDIT_CARD"].includes(`${paymentMode}`.toUpperCase())) return "PAYMENT_GATEWAY";
  return "BANK";
};

const getPaymentAdjustmentConfig = ({ difference, paymentMode, adjustmentSource, reference, notes }) => {
  const adjustmentAmount = Math.abs(roundMoney(difference));
  if (adjustmentAmount <= 0) {
    return {
      adjustmentAmount: 0,
      adjustmentType: "NONE",
      ledgerName: null,
      groupData: null,
      prefix: null,
      isExpense: false,
    };
  }

  const source = getAdjustmentSource({ paymentMode, adjustmentSource, reference, notes });
  const isShortReceipt = difference > 0;

  if (isShortReceipt) {
    if (source === "FOREX") {
      return {
        adjustmentAmount,
        adjustmentType: "FOREX_LOSS",
        ledgerName: "Forex Loss",
        groupData: {
          name: "Indirect Expenses",
          nature: "Expense",
          balanceType: "Debit",
          scheduleMainHead: "P&L",
          scheduleGroup: "Expenses",
          scheduleLineItem: "Other Expenses",
        },
        prefix: "FXLOSS",
        isExpense: true,
      };
    }

    return {
      adjustmentAmount,
      adjustmentType: source === "PAYMENT_GATEWAY" ? "PAYMENT_GATEWAY_CHARGES" : "BANK_CHARGES",
      ledgerName: source === "PAYMENT_GATEWAY" ? "Payment Gateway Charges" : "Bank Charges",
      groupData: {
        name: "Indirect Expenses",
        nature: "Expense",
        balanceType: "Debit",
        scheduleMainHead: "P&L",
        scheduleGroup: "Expenses",
        scheduleLineItem: "Other Expenses",
      },
      prefix: source === "PAYMENT_GATEWAY" ? "PGCHG" : "BNKCHG",
      isExpense: true,
    };
  }

  return {
    adjustmentAmount,
    adjustmentType: source === "FOREX" ? "FOREX_GAIN" : "EXTRA_RECEIPT",
    ledgerName: source === "FOREX" ? "Forex Gain" : "Extra Receipt",
    groupData: {
      name: "Other Income",
      nature: "Income",
      balanceType: "Credit",
      scheduleMainHead: "P&L",
      scheduleGroup: "Revenue",
      scheduleLineItem: "Other Income",
    },
    prefix: source === "FOREX" ? "FXGAIN" : "EXTRCPT",
    isExpense: false,
  };
};

const ensureInvoiceAccounts = async (invoice, userId) => {
  const companyId = invoice.companyId;
  const clientName = getInvoiceClientName(invoice);

  if (!clientName) {
    throw new AppError("Invoice client name is required for accounting posting", 400, "ensureInvoiceAccounts");
  }

  const clientLedger = await ensureLedgerAccount({
    companyId,
    groupData: {
      name: "Trade Receivables",
      nature: "Asset",
      balanceType: "Debit",
      scheduleMainHead: "Assets",
      scheduleGroup: "Current Assets",
      scheduleLineItem: "Trade Receivables",
    },
    accountName: clientName,
    searchPatterns: [clientName, "trade receivable", "sundry debtor"],
    linkedClientId: invoice.billTo?.clientId || null,
    prefix: "AR",
    userId,
    extra: {
      description: `Auto-linked customer ledger for ${clientName}`,
    },
  });

  const salesAccount = await ensureLedgerAccount({
    companyId,
    groupData: {
      name: "Revenue from Operations",
      nature: "Income",
      balanceType: "Credit",
      scheduleMainHead: "P&L",
      scheduleGroup: "Revenue",
      scheduleLineItem: "Revenue from Operations",
    },
    accountName: "Sales Revenue",
    searchPatterns: ["sales", "revenue"],
    prefix: "SALE",
    userId,
  });

  const taxAccounts = {};
  const taxSummary = Array.isArray(invoice.taxSummary) ? invoice.taxSummary : [];
  
  // Legacy support if taxSummary is empty but total amounts exist
  if (taxSummary.length === 0) {
    if (Number(invoice.totalCGSTAmount || 0) > 0) taxSummary.push({ label: "CGST Payable", taxType: "CGST", amount: invoice.totalCGSTAmount });
    if (Number(invoice.totalSGSTAmount || 0) > 0) taxSummary.push({ label: "SGST Payable", taxType: "SGST", amount: invoice.totalSGSTAmount });
    if (Number(invoice.totalIGSTAmount || 0) > 0) taxSummary.push({ label: "IGST Payable", taxType: "IGST", amount: invoice.totalIGSTAmount });
  }

  for (const tax of taxSummary) {
    const label = tax.label || tax.taxType || "Tax";
    const amount = Number(tax.amount || 0);
    if (amount <= 0) continue;

    const accountName = label.toLowerCase().includes("payable") ? label : `${label} Payable`;
    const taxAccount = await ensureLedgerAccount({
      companyId,
      groupData: {
        name: "Taxes Payable",
        nature: "Liability",
        balanceType: "Credit",
        scheduleMainHead: "Equity and Liabilities",
        scheduleGroup: "Current Liabilities",
        scheduleLineItem: "Other Current Liabilities",
      },
      accountName: accountName,
      searchPatterns: [label, tax.taxType || ""],
      prefix: (tax.taxType || "TAX").toUpperCase(),
      userId,
    });
    taxAccounts[label] = taxAccount;
  }

  const tdsAccount = Number(invoice.tdsAmount || invoice.totalTDSAmount || 0) > 0
    ? await ensureLedgerAccount({
        companyId,
        groupData: {
          name: "TDS Receivable",
          nature: "Asset",
          balanceType: "Debit",
          scheduleMainHead: "Assets",
          scheduleGroup: "Current Assets",
          scheduleLineItem: "Other Current Assets",
        },
        accountName: "TDS Receivable",
        searchPatterns: ["tds receivable", "tax deducted at source"],
        prefix: "TDS",
        userId,
      })
    : null;

  return {
    clientName,
    clientLedger,
    salesAccount,
    taxAccounts,
    tdsAccount,
  };
};

const createJournalWithLines = async ({
  journalData,
  lines,
}) => {
  const journal = await createJournalRepo(journalData);

  await createMultipleJournalLinesRepo(
    lines.map((line, index) => ({
      journalId: journal._id,
      companyId: journal.companyId,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      debitAmount: Number(line.debitAmount || 0),
      creditAmount: Number(line.creditAmount || 0),
      description: line.description,
      linkedToClientId: line.linkedToClientId || null,
      linkedToVendorId: line.linkedToVendorId || null,
      lineNumber: index + 1,
    }))
  );

  return getJournalByIdRepo(journal._id);
};

const postSalesJournalForInvoice = async (invoiceId, userId, reqUser = {}) => {
  const invoice = await getInvoiceByIdRepo(invoiceId);

  if (invoice.approvalStatus !== "Approved") {
    throw new AppError("Invoice must be approved before posting sales journal", 400, "postSalesJournalForInvoice");
  }

  if (invoice.salesJournalId) {
    return {
      invoice,
      journal: invoice.salesJournalId,
      alreadyPosted: true,
      ledger: invoice.debtorAccountId || null,
      ledgerAutoCreated: false,
      journalAutoCreated: false,
    };
  }

  const accounts = await ensureInvoiceAccounts(invoice, userId);
  const totalAmount = getInvoiceSettlementAmount(invoice);
  const tdsAmount = Number(invoice.tdsAmount || invoice.totalTDSAmount || 0);
  const netReceivable = totalAmount - tdsAmount;

  const journalLines = [
    {
      accountId: accounts.clientLedger.account._id,
      accountCode: accounts.clientLedger.account.code,
      accountName: accounts.clientLedger.account.name,
      debitAmount: netReceivable,
      creditAmount: 0,
      description: `Invoice receivable ${invoice.invoiceNo} (Net of TDS)`,
      linkedToClientId: invoice.billTo?.clientId || null,
    },
    {
      accountId: accounts.salesAccount.account._id,
      accountCode: accounts.salesAccount.account.code,
      accountName: accounts.salesAccount.account.name,
      debitAmount: 0,
      creditAmount: Number(invoice.totalTaxableValue || 0),
      description: `Sales revenue ${invoice.invoiceNo}`,
    },
  ];

  if (tdsAmount > 0 && accounts.tdsAccount) {
    journalLines.push({
      accountId: accounts.tdsAccount.account._id,
      accountCode: accounts.tdsAccount.account.code,
      accountName: accounts.tdsAccount.account.name,
      debitAmount: tdsAmount,
      creditAmount: 0,
      description: `TDS Receivable for ${invoice.invoiceNo}`,
      linkedToClientId: invoice.billTo?.clientId || null,
    });
  }

  for (const [label, taxAcc] of Object.entries(accounts.taxAccounts)) {
    const taxEntry = invoice.taxSummary?.find(t => (t.label || t.taxType) === label) || {};
    const amount = Number(taxEntry.amount || 0);
    if (amount <= 0) continue;

    journalLines.push({
      accountId: taxAcc.account._id,
      accountCode: taxAcc.account.code,
      accountName: taxAcc.account.name,
      debitAmount: 0,
      creditAmount: amount,
      description: `${label} for ${invoice.invoiceNo}`,
    });
  }

  const journal = await createJournalWithLines({
    journalData: {
      number: generateDocumentNumber("SJR", invoice.companyId),
      voucherType: "SALES",
      date: invoice.invoiceDate || new Date(),
      referenceNumber: invoice.invoiceNo,
      externalDocNo: invoice.poNumber || invoice.linkedPO?.poNumber || invoice.invoiceNo,
      narration: `Sales posting for invoice ${invoice.invoiceNo}`,
      companyId: normalizeCompanyId(invoice.companyId),
      sourceType: "INVOICE",
      sourceId: String(invoice._id),
      partyName: accounts.clientName,
      totalDebit: totalAmount,
      totalCredit: totalAmount,
      status: "Approved",
      approvalStatus: "Approved",
      approvedBy: userId,
      approvalDate: new Date(),
      createdBy: userId,
      updatedBy: userId,
    },
    lines: journalLines,
  });

  const updatedInvoice = await updateInvoiceRepo(invoice._id, {
    salesJournalId: journal._id,
    debtorAccountId: accounts.clientLedger.account._id,
    revenueAccountId: accounts.salesAccount.account._id,
    taxAccountId: Object.values(accounts.taxAccounts)[0]?.account?._id || null, // Primary tax account
    netPayable: getInvoiceSettlementAmount(invoice),
    accountingStatus: "completed",
    updatedBy: userId,
  });

  await createAuditLog({
    companyId: normalizeCompanyId(invoice.companyId),
    entityType: "Invoice",
    entityId: String(invoice._id),
    action: "POST_SALES_JOURNAL",
    userId,
    userEmail: reqUser.email,
    userRole: reqUser.role,
    changes: {
      salesJournalId: journal._id,
      debtorAccountId: accounts.clientLedger.account._id,
      revenueAccountId: accounts.salesAccount.account._id,
      taxAccounts: Object.keys(accounts.taxAccounts),
    },
    description: `Sales journal posted for invoice ${invoice.invoiceNo}`,
  });

  return {
    invoice: updatedInvoice,
    journal,
    ledger: accounts.clientLedger.account,
    ledgerAutoCreated: accounts.clientLedger.autoCreated,
    journalAutoCreated: true,
  };
};

export const recordPaymentForInvoice = async ({
  invoiceId,
  companyId,
  amountPaid,
  tdsAmount,
  paymentDate,
  reference,
  notes,
  paymentMode,
  tdsRate,
  tdsSection,
  clientId,
  bankLedgerId,
  expectedAmount,
  adjustmentSource,
  userId,
  reqUser = {},
}) => {
  const invoice = await getInvoiceByIdRepo(invoiceId);

  if (normalizeCompanyId(invoice.companyId) !== normalizeCompanyId(companyId)) {
    throw new AppError("Invoice does not belong to the provided company", 400, "recordPaymentForInvoice");
  }

  if (!invoice.salesJournalId) {
    throw new AppError("Post the sales journal before recording payments", 400, "recordPaymentForInvoice");
  }

  const normalizedAmountPaid = Number(amountPaid || 0);
  const normalizedTdsAmount = Number(tdsAmount || 0);

  if (normalizedAmountPaid < 0 || normalizedTdsAmount < 0) {
    throw new AppError("Payment and TDS amounts cannot be negative", 400, "recordPaymentForInvoice");
  }

  if (normalizedAmountPaid <= 0 && normalizedTdsAmount <= 0) {
    throw new AppError("Payment amount or TDS amount is required", 400, "recordPaymentForInvoice");
  }

  const outstandingAmount = getOutstandingAmount(invoice);
  // Net outstanding for the client is netPayable - alreadyPaid
  const netOutstanding = Math.max(0, Number(invoice.netPayable || invoice.amountDue - (invoice.tdsAmount || 0)) - Number(invoice.paidAmount || 0));
  const expectedSettlementAmount = roundMoney(
    expectedAmount !== undefined && expectedAmount !== null && expectedAmount !== ""
      ? Number(expectedAmount)
      : netOutstanding
  );
  const settlementDifference = roundMoney(expectedSettlementAmount - normalizedAmountPaid);
  const adjustmentConfig = getPaymentAdjustmentConfig({
    difference: settlementDifference,
    paymentMode,
    adjustmentSource,
    reference,
    notes,
  });
  const grossAmount = expectedSettlementAmount + normalizedTdsAmount;

  if (expectedSettlementAmount <= 0) {
    throw new AppError("Expected settlement amount is required", 400, "recordPaymentForInvoice");
  }

  if (expectedSettlementAmount > netOutstanding + 0.0001) {
    throw new AppError("Expected settlement exceeds invoice outstanding amount", 400, "recordPaymentForInvoice");
  }

  const accounts = await ensureInvoiceAccounts(invoice, userId);
  const paymentLedger =
    `${paymentMode}`.toUpperCase() === "CASH"
      ? await ensureLedgerAccount({
          companyId,
          groupData: PAYMENT_MODE_TO_LEDGER.CASH.group,
          accountName: PAYMENT_MODE_TO_LEDGER.CASH.accountName,
          searchPatterns: ["^Cash In Hand$"],
          prefix: PAYMENT_MODE_TO_LEDGER.CASH.prefix,
          userId,
        })
      : await getPaymentBankLedger({ companyId, bankLedgerId, userId });

  if (!paymentLedger?.account) {
    throw new AppError("Selected bank ledger not found for payment posting", 404, "recordPaymentForInvoice");
  }

  const adjustmentLedger =
    adjustmentConfig.adjustmentAmount > 0
      ? await ensureLedgerAccount({
          companyId,
          groupData: adjustmentConfig.groupData,
          accountName: adjustmentConfig.ledgerName,
          searchPatterns: [adjustmentConfig.ledgerName, adjustmentConfig.adjustmentType.replaceAll("_", " ")],
          prefix: adjustmentConfig.prefix,
          userId,
          extra: {
            description: `Auto-created ledger for ${adjustmentConfig.ledgerName}`,
          },
        })
      : null;

  const tdsLedger =
    normalizedTdsAmount > 0
      ? await ensureLedgerAccount({
          companyId,
          groupData: {
            name: "TDS Receivable",
            nature: "Asset",
            balanceType: "Debit",
            scheduleMainHead: "Assets",
            scheduleGroup: "Current Assets",
            scheduleLineItem: "Other Current Assets",
          },
          accountName: "TDS Receivable",
          searchPatterns: ["tds receivable", "tax deducted at source"],
          prefix: "TDS",
          userId,
        })
      : null;

  const paymentJournalLines = [];

  if (normalizedAmountPaid > 0) {
    paymentJournalLines.push({
      accountId: paymentLedger.account._id,
      accountCode: paymentLedger.account.code,
      accountName: paymentLedger.account.name,
      debitAmount: normalizedAmountPaid,
      creditAmount: 0,
      description: `Payment received for ${invoice.invoiceNo}`,
      linkedToClientId: clientId || invoice.billTo?.clientId || null,
    });
  }

  if (normalizedTdsAmount > 0 && tdsLedger) {
    paymentJournalLines.push({
      accountId: tdsLedger.account._id,
      accountCode: tdsLedger.account.code,
      accountName: tdsLedger.account.name,
      debitAmount: normalizedTdsAmount,
      creditAmount: 0,
      description: `TDS deducted for ${invoice.invoiceNo}`,
      linkedToClientId: clientId || invoice.billTo?.clientId || null,
    });
  }

  if (adjustmentLedger?.account && adjustmentConfig.adjustmentAmount > 0) {
    paymentJournalLines.push({
      accountId: adjustmentLedger.account._id,
      accountCode: adjustmentLedger.account.code,
      accountName: adjustmentLedger.account.name,
      debitAmount: adjustmentConfig.isExpense ? adjustmentConfig.adjustmentAmount : 0,
      creditAmount: adjustmentConfig.isExpense ? 0 : adjustmentConfig.adjustmentAmount,
      description: `${adjustmentConfig.ledgerName} adjustment for ${invoice.invoiceNo}`,
      linkedToClientId: clientId || invoice.billTo?.clientId || null,
    });
  }

  paymentJournalLines.push({
    accountId: accounts.clientLedger.account._id,
    accountCode: accounts.clientLedger.account.code,
    accountName: accounts.clientLedger.account.name,
    debitAmount: 0,
    creditAmount: grossAmount,
    description: `Receivable settlement for ${invoice.invoiceNo}`,
    linkedToClientId: clientId || invoice.billTo?.clientId || null,
  });

  const paymentJournal = await createJournalWithLines({
    journalData: {
      number: generateDocumentNumber("RCV", companyId),
      voucherType: "RECEIPT",
      date: paymentDate ? new Date(paymentDate) : new Date(),
      referenceNumber: reference || invoice.invoiceNo,
      externalDocNo: invoice.invoiceNo,
      narration: `Receipt posted for invoice ${invoice.invoiceNo}`,
      companyId: normalizeCompanyId(companyId),
      sourceType: "PAYMENT",
      sourceId: String(invoice._id),
      partyName: accounts.clientName,
      totalDebit: paymentJournalLines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0),
      totalCredit: paymentJournalLines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0),
      status: "Approved",
      approvalStatus: "Approved",
      approvedBy: userId,
      approvalDate: new Date(),
      createdBy: userId,
      updatedBy: userId,
    },
    lines: paymentJournalLines,
  });

  const paymentRecord = await createPaymentRepo({
    invoiceId: String(invoice._id),
    companyId: normalizeCompanyId(companyId),
    clientId: clientId || invoice.billTo?.clientId || null,
    amountPaid: normalizedAmountPaid,
    originalAmount: expectedSettlementAmount,
    receivedAmount: normalizedAmountPaid,
    adjustmentAmount: adjustmentConfig.adjustmentAmount,
    adjustmentType: adjustmentConfig.adjustmentType,
    adjustmentLedgerId: adjustmentLedger?.account?._id || null,
    tdsAmount: normalizedTdsAmount,
    tdsRate: Number(tdsRate || 0),
    tdsSection: tdsSection || "",
    grossAmount,
    paymentMode: paymentMode || "BANK_TRANSFER",
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    reference: reference || "",
    notes: notes || "",
    status: "COMPLETED",
    journalId: paymentJournal._id,
    createdBy: userId,
    updatedBy: userId,
  });

  const newRemaining = Math.max(0, getOutstandingAmount(invoice) - expectedSettlementAmount);
  const totalSettled = Number(invoice.paidAmount || 0) + expectedSettlementAmount + Number(invoice.tdsAmount || 0) + normalizedTdsAmount;
  
  const updatedInvoice = await updateInvoiceRepo(invoice._id, {
    paidAmount: Number(invoice.paidAmount || 0) + expectedSettlementAmount,
    tdsAmount: Number(invoice.tdsAmount || 0) + normalizedTdsAmount,
    netPayable: getInvoiceSettlementAmount(invoice),
    remainingAmount: newRemaining,
    status: newRemaining < 0.01 ? "PAID" : totalSettled > 0 ? "PARTIALLY_PAID" : invoice.status,
    isFullyPaid: newRemaining < 0.01,
    paymentIds: [
      ...((invoice.paymentIds || []).map((payment) =>
        typeof payment === "object" && payment !== null ? payment._id : payment
      )),
      paymentRecord._id,
    ],
    updatedBy: userId,
  });

  await createAuditLog({
    companyId: normalizeCompanyId(companyId),
    entityType: "Payment",
    entityId: String(paymentRecord._id),
    action: "POST_RECEIPT",
    userId,
    userEmail: reqUser.email,
    userRole: reqUser.role,
    changes: {
      invoiceId: invoice._id,
      journalId: paymentJournal._id,
      amountPaid: normalizedAmountPaid,
      originalAmount: expectedSettlementAmount,
      receivedAmount: normalizedAmountPaid,
      adjustmentAmount: adjustmentConfig.adjustmentAmount,
      adjustmentType: adjustmentConfig.adjustmentType,
      adjustmentLedgerId: adjustmentLedger?.account?._id || null,
      tdsAmount: normalizedTdsAmount,
      paymentMode,
    },
    description: `Payment posted for invoice ${invoice.invoiceNo}`,
  });

  return {
    payment: paymentRecord,
    journal: paymentJournal,
    invoice: updatedInvoice,
    ledger: accounts.clientLedger.account,
    adjustmentLedger: adjustmentLedger?.account || null,
  };
};

export const validateInvoiceAccounts = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const Account = await getAccountModel();
    const Group = await getGroupModel();
    const normalizedCompanyId = normalizeCompanyId(companyId);

    const accounts = await Account.find({
      companyId: normalizedCompanyId,
      isActive: true,
    }).lean();

    const groups = await Group.find({
      companyId: normalizedCompanyId,
      isActive: true,
    }).lean();

    const tradeReceivablesGroup = groups.find(
      (group) =>
        group.scheduleMainHead === "Assets" &&
        group.scheduleLineItem === "Trade Receivables"
    );

    const existingAccounts = [];
    const missingAccounts = [];

    if (tradeReceivablesGroup) {
      existingAccounts.push({
        type: "debtor_group",
        name: tradeReceivablesGroup.name,
        exists: true,
      });
    } else {
      missingAccounts.push({
        type: "debtor_group",
        exists: false,
        optional: true,
        message: "Trade Receivables group will be auto-created during posting",
      });
    }

    const findAccount = (matcher) => accounts.find(matcher);

    const salesAccount = findAccount(
      (account) =>
        /sales|revenue/i.test(account.name || "") ||
        account.scheduleMapping?.scheduleLineItem === "Revenue from Operations"
    );

    const cgstAccount = findAccount((account) => /cgst/i.test(account.name || ""));
    const sgstAccount = findAccount((account) => /sgst/i.test(account.name || ""));
    const igstAccount = findAccount((account) => /igst/i.test(account.name || ""));
    const vatAccount = findAccount((account) => /vat/i.test(account.name || ""));
    const salesTaxAccount = findAccount((account) => /sales tax/i.test(account.name || ""));
    const tdsAccount = findAccount((account) => /tds receivable/i.test(account.name || ""));

    if (salesAccount) {
      existingAccounts.push({
        type: "sales",
        name: salesAccount.name,
        code: salesAccount.code,
        exists: true,
      });
    } else {
      missingAccounts.push({
        type: "sales",
        exists: false,
        optional: true,
        message: "Sales ledger will be auto-created during posting",
      });
    }

    for (const [type, account] of [
      ["cgst", cgstAccount],
      ["sgst", sgstAccount],
      ["igst", igstAccount],
      ["vat", vatAccount],
      ["sales_tax", salesTaxAccount],
      ["tds", tdsAccount],
    ]) {
      if (account) {
        existingAccounts.push({
          type,
          name: account.name,
          code: account.code,
          exists: true,
        });
      } else {
        missingAccounts.push({
          type,
          exists: false,
          optional: true,
          message: `${type.toUpperCase()} ledger will be auto-created when needed`,
        });
      }
    }

    new ApiResponse({
      statusCode: 200,
      data: {
        existingAccounts,
        missingAccounts,
        allRequiredAccountsExist: true,
      },
      message: "Invoice accounting validation completed",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const createClientLedgerFromInvoice = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { invoiceId } = req.body;
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (normalizeCompanyId(invoice.companyId) !== normalizeCompanyId(companyId)) {
      throw new AppError("Invoice does not belong to the provided company", 400, "createClientLedgerFromInvoice");
    }

    const userId = getUserId(req);
    const accounts = await ensureInvoiceAccounts(invoice, userId);

    const updatedInvoice = await updateInvoiceRepo(invoice._id, {
      debtorAccountId: accounts.clientLedger.account._id,
      revenueAccountId: invoice.revenueAccountId || accounts.salesAccount.account._id,
      taxAccountId:
        invoice.taxAccountId ||
        accounts[getTaxLedgerField(invoice)]?.account?._id ||
        null,
      updatedBy: userId,
    });

    new ApiResponse({
      statusCode: accounts.clientLedger.autoCreated ? 201 : 200,
      data: {
        ledger: {
          ...(accounts.clientLedger.account?.toObject?.() || accounts.clientLedger.account || {}),
          autoCreated: accounts.clientLedger.autoCreated,
        },
        invoice: updatedInvoice,
      },
      message: accounts.clientLedger.autoCreated
        ? "Client ledger created successfully"
        : "Client ledger linked successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const createJournalFromInvoice = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { invoiceId } = req.body;
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (normalizeCompanyId(invoice.companyId) !== normalizeCompanyId(companyId)) {
      throw new AppError("Invoice does not belong to the provided company", 400, "createJournalFromInvoice");
    }

    const result = await postSalesJournalForInvoice(invoiceId, getUserId(req), req.user || {});

    new ApiResponse({
      statusCode: result.alreadyPosted ? 200 : 201,
      data: {
        journal: result.journal,
        ledger: result.ledger,
        invoice: result.invoice,
      },
      message: result.alreadyPosted
        ? "Sales journal already posted for this invoice"
        : "Sales journal posted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const completeInvoiceAccounting = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { invoiceId } = req.body;
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (normalizeCompanyId(invoice.companyId) !== normalizeCompanyId(companyId)) {
      throw new AppError("Invoice does not belong to the provided company", 400, "completeInvoiceAccounting");
    }

    const result = await postSalesJournalForInvoice(invoiceId, getUserId(req), req.user || {});

    new ApiResponse({
      statusCode: result.alreadyPosted ? 200 : 201,
      data: {
        ledger: {
          ...(result.ledger?.toObject?.() || result.ledger || {}),
          autoCreated: result.ledgerAutoCreated,
        },
        journal: {
          ...(result.journal?.toObject?.() || result.journal || {}),
          autoCreated: result.journalAutoCreated,
        },
        invoice: result.invoice,
        accountingSummary: {
          taxableValue: Number(result.invoice.totalTaxableValue || 0),
          totalTax:
            Number(result.invoice.totalCGSTAmount || 0) +
            Number(result.invoice.totalSGSTAmount || 0) +
            Number(result.invoice.totalIGSTAmount || 0),
          tdsAmount: Number(result.invoice.tdsAmount || 0),
          netPayable: getInvoiceSettlementAmount(result.invoice),
        },
      },
      message: result.alreadyPosted
        ? "Sales journal already posted for this invoice"
        : "Invoice accounting completed successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceAccountingStatus = async (req, res, next) => {
  try {
    const { companyId, invoiceId } = req.params;
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (normalizeCompanyId(invoice.companyId) !== normalizeCompanyId(companyId)) {
      throw new AppError("Invoice does not belong to the provided company", 400, "getInvoiceAccountingStatus");
    }

    const payments = await getPaymentsByInvoiceRepo(invoiceId, normalizeCompanyId(companyId));

    new ApiResponse({
      statusCode: 200,
      data: {
        invoice,
        accountingStatus: invoice.accountingStatus,
        salesJournalId: invoice.salesJournalId,
        debtorAccountId: invoice.debtorAccountId,
        revenueAccountId: invoice.revenueAccountId,
        taxAccountId: invoice.taxAccountId,
        payments,
      },
      message: "Invoice accounting status retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const recordInvoicePayment = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const {
      invoiceId,
      clientId,
      amountPaid,
      tdsAmount,
      tdsRate,
      tdsSection,
      paymentMode,
      paymentDate,
      reference,
      notes,
      bankLedgerId,
      expectedAmount,
      adjustmentSource,
    } = req.body;

    if (!invoiceId) {
      throw new AppError("Invoice ID is required", 400, "recordInvoicePayment");
    }

    const result = await recordPaymentForInvoice({
      invoiceId,
      companyId,
      clientId,
      amountPaid,
      tdsAmount,
      tdsRate,
      tdsSection,
      paymentMode,
      paymentDate,
      reference,
      notes,
      bankLedgerId,
      expectedAmount,
      adjustmentSource,
      userId: getUserId(req),
      reqUser: req.user || {},
    });

    new ApiResponse({
      statusCode: 201,
      data: result,
      message: "Payment posted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceTdsReport = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { fromDate, toDate } = req.query;

    // 1. Get TDS from payments (Realized TDS)
    const payments = await getDetailedTDSReportRepo(companyId, fromDate, toDate);
    
    // 2. Get TDS from invoices (Provisioned TDS at Sales Posting)
    const invoicesWithTds = await getInvoicesWithTDSRepo(companyId, fromDate, toDate);

    const reportRows = [];

    // Process payment TDS
    for (const payment of payments) {
      try {
        const invoice = await getInvoiceByIdRepo(payment.invoiceId);
        reportRows.push({
          invoiceNo: invoice?.invoiceNo || "N/A",
          clientName: invoice?.billTo?.name || "N/A",
          paymentDate: payment.paymentDate,
          reference: payment.reference || "Payment Adjustment",
          receivedAmount: Number(payment.amountPaid || 0),
          tdsAmount: Number(payment.tdsAmount || 0),
          settledAmount: Number(payment.grossAmount || (payment.amountPaid + payment.tdsAmount)),
          type: "PAYMENT",
        });
      } catch (err) {
        // Fallback if invoice not found
        reportRows.push({
          invoiceNo: "N/A",
          clientName: "N/A",
          paymentDate: payment.paymentDate || new Date(),
          reference: payment.reference || "Payment Adjustment",
          receivedAmount: Number(payment.amountPaid || 0),
          tdsAmount: Number(payment.tdsAmount || 0),
          settledAmount: Number(payment.grossAmount || (payment.amountPaid + payment.tdsAmount)),
          type: "PAYMENT",
        });
      }
    }

    // Process invoice TDS (if not already covered by a payment record that includes TDS)
    // In this system, if TDS is booked at Sales Posting, it's tracked in invoice.tdsAmount.
    // If it's deducted at Payment time, it's in payment.tdsAmount.
    for (const invoice of invoicesWithTds) {
      // Avoid double counting: if this invoice has payments that already carry TDS,
      // we should be careful. But usually, if invoice.tdsAmount > 0, it means it was provisioned.
      // We'll show it as a "Provisioned" entry.
      
      // Check if we already have a payment for this invoice that might have "collected" this same TDS.
      // But typically, provisioned TDS is a separate ledger entry from payment-time TDS.
      reportRows.push({
        invoiceNo: invoice.invoiceNo,
        clientName: invoice.billTo?.name || "N/A",
        paymentDate: invoice.invoiceDate || invoice.createdAt || new Date(),
        reference: "Sales Posting (Provision)",
        receivedAmount: 0,
        tdsAmount: Number(invoice.tdsAmount || invoice.totalTDSAmount || 0),
        settledAmount: Number(invoice.tdsAmount || invoice.totalTDSAmount || 0),
        type: "INVOICE_PROVISION",
      });
    }

    // Sort by date descending
    reportRows.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    new ApiResponse({
      statusCode: 200,
      data: reportRows,
      message: "TDS report retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
