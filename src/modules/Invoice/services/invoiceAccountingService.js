import AppError from "../../../utils/AppError.js";
import { getInvoiceByIdRepo, updateInvoiceAccountingStatusRepo } from "../repos/invoiceRepo.js";
import { updatePurchaseOrderRepo } from "../repos/purchaseOrderRepo.js";

// Import accounting module models and repos (if available)
let accountingModuleAvailable = false;
let accountingDb = null;
let journalRepo = null;
let accountRepo = null;

try {
  // These will be imported dynamically based on module availability
  accountingModuleAvailable = true;
} catch (error) {
  console.warn("Accounting module not available - journal creation will be disabled");
}

export const setAccountingDependencies = (journal, account) => {
  journalRepo = journal;
  accountRepo = account;
  accountingModuleAvailable = !!journal && !!account;
};

export const createInvoiceJournalEntry = async (invoiceId, companyId, userId) => {
  try {
    if (!accountingModuleAvailable || !journalRepo || !accountRepo) {
      console.warn(
        "Accounting module dependencies not available - skipping journal creation"
      );
      return {
        success: false,
        message: "Accounting module not available",
        journalId: null,
      };
    }

    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "createInvoiceJournalEntry");
    }

    if (invoice.accountingStatus === "completed" || invoice.salesJournalId) {
      throw new AppError(
        "Journal entry already exists for this invoice",
        400,
        "createInvoiceJournalEntry"
      );
    }

    // Extract client information from billTo
    const clientName = invoice.billTo?.clientName || "Unknown Client";
    const clientGSTIN = invoice.billTo?.gstin || "";

    // Create or get Debtor account
    let debtorAccount = null;
    if (invoice.debtorAccountId) {
      // Account already linked
      debtorAccount = { _id: invoice.debtorAccountId };
    } else {
      // Try to create or find debtor account
      if (accountRepo && accountRepo.getOrCreateAccountRepo) {
        debtorAccount = await accountRepo.getOrCreateAccountRepo({
          companyId,
          accountName: `Debtor - ${clientName}`,
          accountCode: `DBT-${clientName.slice(0, 3).toUpperCase()}`,
          accountGroup: "Debtors",
          accountType: "Asset",
          parentGroup: "Current Assets",
        });
      }
    }

    // Create or get Revenue account
    let revenueAccount = null;
    if (invoice.revenueAccountId) {
      revenueAccount = { _id: invoice.revenueAccountId };
    } else {
      if (accountRepo && accountRepo.getOrCreateAccountRepo) {
        revenueAccount = await accountRepo.getOrCreateAccountRepo({
          companyId,
          accountName: "Sales Revenue",
          accountCode: "SAL-CODE",
          accountGroup: "Sales Accounts",
          accountType: "Income",
          parentGroup: "Revenue",
        });
      }
    }

    // Create or get Tax Payable account
    let taxAccount = null;
    if (invoice.taxAccountId) {
      taxAccount = { _id: invoice.taxAccountId };
    } else {
      if (accountRepo && accountRepo.getOrCreateAccountRepo) {
        // Determine GST type from invoice items
        const hasIGST = invoice.totalIGSTAmount > 0;
        const taxAccountName = hasIGST ? "IGST Payable" : "GST Payable";
        const taxAccountCode = hasIGST ? "IGST-PAY" : "GST-PAY";

        taxAccount = await accountRepo.getOrCreateAccountRepo({
          companyId,
          accountName: taxAccountName,
          accountCode: taxAccountCode,
          accountGroup: "Tax Accounts",
          accountType: "Liability",
          parentGroup: "Current Liabilities",
        });
      }
    }

    // Create Journal Entry
    const journalData = {
      companyId,
      journalDate: invoice.invoiceDate,
      description: `Sales Journal - Invoice #${invoice.invoiceNo}`,
      reference: `INV-${invoice.invoiceNo}`,
      referenceType: "Invoice",
      referenceId: invoiceId,
      journalLines: [
        // Debit Debtor Account
        {
          accountId: debtorAccount._id,
          accountName: debtorAccount.accountName || clientName,
          accountCode: debtorAccount.accountCode,
          amount: invoice.invoiceAmount,
          debit: invoice.invoiceAmount,
          credit: 0,
          description: `Sales to ${clientName}`,
          lineOrder: 1,
        },
        // Credit Revenue Account
        {
          accountId: revenueAccount._id,
          accountName: revenueAccount.accountName || "Sales Revenue",
          accountCode: revenueAccount.accountCode,
          amount: invoice.totalTaxableValue,
          debit: 0,
          credit: invoice.totalTaxableValue,
          description: "Revenue from sales",
          lineOrder: 2,
        },
        // Credit Tax Payable Account (if GST exists)
        ...(invoice.totalGSTAmount > 0
          ? [
              {
                accountId: taxAccount._id,
                accountName: taxAccount.accountName || "GST Payable",
                accountCode: taxAccount.accountCode,
                amount: invoice.totalGSTAmount,
                debit: 0,
                credit: invoice.totalGSTAmount,
                description: `GST Payable - ${invoice.totalGSTAmount}`,
                lineOrder: 3,
              },
            ]
          : []),
      ],
      status: "POSTED",
      approvalStatus: "Approved",
      createdBy: userId,
      updatedBy: userId,
    };

    // Create journal using accounting module
    let journal = null;
    if (journalRepo && journalRepo.createJournalRepo) {
      journal = await journalRepo.createJournalRepo(journalData);
    } else {
      throw new AppError(
        "Journal creation function not available",
        500,
        "createInvoiceJournalEntry"
      );
    }

    // Update invoice with journal reference
    await updateInvoiceAccountingStatusRepo(invoiceId, journal._id, "completed");

    // Update invoice with account references
    await updateInvoiceAccountingStatusRepo(
      invoiceId,
      journal._id,
      "completed",
      debtorAccount._id,
      revenueAccount._id,
      taxAccount._id
    );

    return {
      success: true,
      journalId: journal._id,
      journalNumber: journal.journalNumber,
      message: "Journal entry created successfully",
      journalDetails: {
        journalNo: journal.journalNumber,
        journalDate: journal.journalDate,
        reference: journal.reference,
        totalDebit: journalData.journalLines.reduce((sum, line) => sum + line.debit, 0),
        totalCredit: journalData.journalLines.reduce((sum, line) => sum + line.credit, 0),
        lineCount: journalData.journalLines.length,
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "createInvoiceJournalEntry");
  }
};

export const syncInvoicePOProgress = async (invoiceId, companyId) => {
  try {
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (!invoice || !invoice.linkedPO) {
      return {
        success: false,
        message: "Invoice not linked to any Purchase Order",
      };
    }

    const { getPurchaseOrderByIdRepo } = await import("../repos/purchaseOrderRepo.js");
    const purchaseOrder = await getPurchaseOrderByIdRepo(invoice.linkedPO);

    if (!purchaseOrder) {
      throw new AppError("Purchase Order not found", 404, "syncInvoicePOProgress");
    }

    // Calculate new invoice total
    const invoicedAmount = invoice.invoiceAmount;
    const newTotalInvoicedAmount = (purchaseOrder.totalInvoicedAmount || 0) + invoicedAmount;

    // Determine new status
    let newStatus = "OPEN";
    if (newTotalInvoicedAmount >= purchaseOrder.totalAmount) {
      newStatus = "FULLY_INVOICED";
    } else if (newTotalInvoicedAmount > 0) {
      newStatus = "PARTIALLY_INVOICED";
    }

    // Update PO
    await updatePurchaseOrderRepo(invoice.linkedPO, {
      totalInvoicedAmount: newTotalInvoicedAmount,
      status: newStatus,
      updatedBy: "system",
    });

    return {
      success: true,
      message: "Purchase Order progress synchronized",
      syncDetails: {
        poNumber: purchaseOrder.poNumber,
        previousInvoicedAmount: purchaseOrder.totalInvoicedAmount || 0,
        additionalInvoicedAmount: invoicedAmount,
        newTotalInvoicedAmount,
        newStatus,
        remainingAmount: Math.max(0, purchaseOrder.totalAmount - newTotalInvoicedAmount),
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "syncInvoicePOProgress");
  }
};

export const reconcileInvoice = async (invoiceId, companyId, userId) => {
  try {
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "reconcileInvoice");
    }

    if (invoice.status !== "PAID") {
      throw new AppError(
        "Only fully paid invoices can be reconciled",
        400,
        "reconcileInvoice"
      );
    }

    // Update invoice status to RECONCILED
    const { updateInvoiceRepo } = await import("../repos/invoiceRepo.js");
    await updateInvoiceRepo(invoiceId, {
      status: "RECONCILED",
      updatedBy: userId,
    });

    return {
      success: true,
      message: "Invoice reconciled successfully",
      invoiceDetails: {
        invoiceNo: invoice.invoiceNo,
        status: "RECONCILED",
        reconcileDate: new Date(),
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "reconcileInvoice");
  }
};

export const getInvoiceAccountingStatus = async (invoiceId) => {
  try {
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "getInvoiceAccountingStatus");
    }

    return {
      invoiceNo: invoice.invoiceNo,
      status: invoice.status,
      accountingStatus: invoice.accountingStatus,
      salesJournalId: invoice.salesJournalId,
      debtorAccountId: invoice.debtorAccountId,
      revenueAccountId: invoice.revenueAccountId,
      taxAccountId: invoice.taxAccountId,
      financial: {
        invoiceAmount: invoice.invoiceAmount,
        paidAmount: invoice.paidAmount || 0,
        remainingAmount: invoice.remainingAmount,
        tdsAmount: invoice.tdsAmount || 0,
      },
      approval: {
        approvalStatus: invoice.approvalStatus,
        approvedBy: invoice.approvedBy,
        approvalDate: invoice.approvalDate,
      },
      linkedPO: invoice.linkedPO,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "getInvoiceAccountingStatus");
  }
};
