import mongoose from "mongoose";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { getInvoiceByIdRepo, updateInvoiceRepo } from "../repos/invoiceRepo.js";
import { getPaymentsByInvoiceRepo, createPaymentRepo } from "../../Account/repos/paymentRepo.js";
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
    accountName: "Bank Clearing Account",
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
    accountName: "Bank Clearing Account",
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

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCompanyId = (companyId) => String(companyId);

const getUserId = (req) => req.user?.id || req.user?._id?.toString() || null;

const getInvoiceClientName = (invoice) =>
  invoice?.billTo?.name?.trim() || invoice?.shipTo?.name?.trim() || "";

const generateDocumentNumber = (prefix, companyId) =>
  `${prefix}-${normalizeCompanyId(companyId).slice(-4)}-${Date.now()}`;

const getInvoiceSettlementAmount = (invoice) =>
  Number(invoice.invoiceAmount || invoice.amountDue || 0);

const getOutstandingAmount = (invoice) => {
  const settledAmount = Number(invoice.paidAmount || 0) + Number(invoice.tdsAmount || 0);
  return Math.max(0, getInvoiceSettlementAmount(invoice) - settledAmount);
};

const getTaxLedgerField = (invoice) => {
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

  const cgstAccount =
    Number(invoice.totalCGSTAmount || 0) > 0
      ? await ensureLedgerAccount({
          companyId,
          groupData: {
            name: "GST Payable",
            nature: "Liability",
            balanceType: "Credit",
            scheduleMainHead: "Equity and Liabilities",
            scheduleGroup: "Current Liabilities",
            scheduleLineItem: "Other Current Liabilities",
          },
          accountName: "CGST Payable",
          searchPatterns: ["cgst"],
          prefix: "CGST",
          userId,
        })
      : null;

  const sgstAccount =
    Number(invoice.totalSGSTAmount || 0) > 0
      ? await ensureLedgerAccount({
          companyId,
          groupData: {
            name: "GST Payable",
            nature: "Liability",
            balanceType: "Credit",
            scheduleMainHead: "Equity and Liabilities",
            scheduleGroup: "Current Liabilities",
            scheduleLineItem: "Other Current Liabilities",
          },
          accountName: "SGST Payable",
          searchPatterns: ["sgst"],
          prefix: "SGST",
          userId,
        })
      : null;

  const igstAccount =
    Number(invoice.totalIGSTAmount || 0) > 0
      ? await ensureLedgerAccount({
          companyId,
          groupData: {
            name: "GST Payable",
            nature: "Liability",
            balanceType: "Credit",
            scheduleMainHead: "Equity and Liabilities",
            scheduleGroup: "Current Liabilities",
            scheduleLineItem: "Other Current Liabilities",
          },
          accountName: "IGST Payable",
          searchPatterns: ["igst"],
          prefix: "IGST",
          userId,
        })
      : null;

  return {
    clientName,
    clientLedger,
    salesAccount,
    cgstAccount,
    sgstAccount,
    igstAccount,
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

  const journalLines = [
    {
      accountId: accounts.clientLedger.account._id,
      accountCode: accounts.clientLedger.account.code,
      accountName: accounts.clientLedger.account.name,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: `Invoice receivable ${invoice.invoiceNo}`,
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

  if (Number(invoice.totalCGSTAmount || 0) > 0 && accounts.cgstAccount) {
    journalLines.push({
      accountId: accounts.cgstAccount.account._id,
      accountCode: accounts.cgstAccount.account.code,
      accountName: accounts.cgstAccount.account.name,
      debitAmount: 0,
      creditAmount: Number(invoice.totalCGSTAmount || 0),
      description: `CGST for ${invoice.invoiceNo}`,
    });
  }

  if (Number(invoice.totalSGSTAmount || 0) > 0 && accounts.sgstAccount) {
    journalLines.push({
      accountId: accounts.sgstAccount.account._id,
      accountCode: accounts.sgstAccount.account.code,
      accountName: accounts.sgstAccount.account.name,
      debitAmount: 0,
      creditAmount: Number(invoice.totalSGSTAmount || 0),
      description: `SGST for ${invoice.invoiceNo}`,
    });
  }

  if (Number(invoice.totalIGSTAmount || 0) > 0 && accounts.igstAccount) {
    journalLines.push({
      accountId: accounts.igstAccount.account._id,
      accountCode: accounts.igstAccount.account.code,
      accountName: accounts.igstAccount.account.name,
      debitAmount: 0,
      creditAmount: Number(invoice.totalIGSTAmount || 0),
      description: `IGST for ${invoice.invoiceNo}`,
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

  const taxField = getTaxLedgerField(invoice);

  const updatedInvoice = await updateInvoiceRepo(invoice._id, {
    salesJournalId: journal._id,
    debtorAccountId: accounts.clientLedger.account._id,
    revenueAccountId: accounts.salesAccount.account._id,
    taxAccountId: taxField ? accounts[taxField]?.account?._id || null : null,
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
      taxAccountId: taxField ? accounts[taxField]?.account?._id || null : null,
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

const recordPaymentForInvoice = async ({
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
  const grossAmount = normalizedAmountPaid + normalizedTdsAmount;

  if (grossAmount <= 0) {
    throw new AppError("Payment amount or TDS amount is required", 400, "recordPaymentForInvoice");
  }

  const outstandingAmount = getOutstandingAmount(invoice);
  if (grossAmount > outstandingAmount + 0.0001) {
    throw new AppError("Payment exceeds invoice outstanding amount", 400, "recordPaymentForInvoice");
  }

  const accounts = await ensureInvoiceAccounts(invoice, userId);
  const paymentLedgerConfig = PAYMENT_MODE_TO_LEDGER[paymentMode] || PAYMENT_MODE_TO_LEDGER.BANK_TRANSFER;
  const paymentLedger = await ensureLedgerAccount({
    companyId,
    groupData: paymentLedgerConfig.group,
    accountName: paymentLedgerConfig.accountName,
    searchPatterns: [paymentLedgerConfig.accountName, paymentMode?.replaceAll("_", " ") || "bank"],
    prefix: paymentLedgerConfig.prefix,
    userId,
  });

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
      totalDebit: grossAmount,
      totalCredit: grossAmount,
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

  const updatedInvoice = await updateInvoiceRepo(invoice._id, {
    paidAmount: Number(invoice.paidAmount || 0) + normalizedAmountPaid,
    tdsAmount: Number(invoice.tdsAmount || 0) + normalizedTdsAmount,
    remainingAmount: Math.max(0, getOutstandingAmount(invoice) - grossAmount),
    status:
      Math.max(0, getOutstandingAmount(invoice) - grossAmount) === 0
        ? "PAID"
        : Number(invoice.paidAmount || 0) + normalizedAmountPaid + Number(invoice.tdsAmount || 0) + normalizedTdsAmount > 0
          ? "PARTIALLY_PAID"
          : invoice.status,
    isFullyPaid: Math.max(0, getOutstandingAmount(invoice) - grossAmount) === 0,
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
