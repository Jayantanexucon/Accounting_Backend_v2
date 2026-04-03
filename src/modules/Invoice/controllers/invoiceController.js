import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { transactionManager } from "../../../utils/transactionManager.js";
import {
  createInvoiceRepo,
  getInvoiceByIdRepo,
  getInvoicesRepo,
  getInvoiceByNumberRepo,
  updateInvoiceRepo,
  deleteInvoiceRepo,
  getInvoicesByPORepo,
  getInvoicesByStatusRepo,
  getInvoicesByDateRangeRepo,
  getInvoicePendingApprovalRepo,
  getInvoiceStatsRepo,
  updateInvoicePaymentRepo,
  updateInvoiceAccountingStatusRepo,
} from "../repos/invoiceRepo.js";
import { createJournalRepo, updateJournalRepo } from "../../Account/repos/journalRepo.js";
import { getPurchaseOrderByIdRepo, updatePurchaseOrderRepo } from "../repos/purchaseOrderRepo.js";
import { exportInvoice, exportInvoiceList } from "../services/invoiceExportService.js";
import {
  sendInvoiceCreatedNotification,
  sendInvoiceApprovedNotification,
  sendInvoiceRejectedNotification,
  sendPaymentRecordedNotification,
} from "../services/notificationService.js";

const generateInvoiceNumber = async (companyId) => {
  const timestamp = Date.now();
  return `INV-${companyId.toString().slice(-4)}-${timestamp}`;
};

export const createInvoice = async (req, res, next) => {
  try {
    const {
      linkedPO,
      invoiceDate,
      dueDate,
      billTo,
      shipTo,
      items,
      companyId,
      notes,
    } = req.body;

    if (!invoiceDate || !dueDate || !billTo || !shipTo || !items || items.length === 0 || !companyId) {
      throw new AppError(
        "Missing required fields: invoiceDate, dueDate, billTo, shipTo, items, companyId",
        400,
        "createInvoice"
      );
    }

    let totalTaxableValue = 0;
    let totalCGSTAmount = 0;
    let totalSGSTAmount = 0;
    let totalIGSTAmount = 0;
    let totalGSTAmount = 0;
    let invoiceAmount = 0;

    items.forEach((item) => {
      totalTaxableValue += item.taxableValue || 0;
      totalCGSTAmount += item.cgstAmount || 0;
      totalSGSTAmount += item.sgstAmount || 0;
      totalIGSTAmount += item.igstAmount || 0;
      totalGSTAmount += item.gstAmount || 0;
      invoiceAmount += item.totalAmount || 0;
    });

    const invoiceNumber = await generateInvoiceNumber(companyId);

    const invoiceData = {
      companyId,
      invoiceNo: invoiceNumber,
      linkedPO,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      billTo,
      shipTo,
      items,
      totalTaxableValue,
      totalCGSTAmount,
      totalSGSTAmount,
      totalIGSTAmount,
      totalGSTAmount,
      invoiceAmount,
      amountDue: invoiceAmount,
      netPayable: invoiceAmount,
      remainingAmount: invoiceAmount,
      valueInWords: `${invoiceAmount} only`,
      notes,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    };

    const invoice = await createInvoiceRepo(invoiceData);

    // If linked to PO, update PO with invoice reference
    if (linkedPO) {
      const po = await getPurchaseOrderByIdRepo(linkedPO);
      await updatePurchaseOrderRepo(linkedPO, {
        invoiceIds: [...(po.invoiceIds || []), invoice._id],
        totalInvoicedAmount: (po.totalInvoicedAmount || 0) + invoiceAmount,
        updatedBy: req.user?.id,
      });
    }

    await createAuditLog({
      companyId,
      entityType: "Invoice",
      entityId: invoice._id,
      action: "CREATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: invoiceData,
      description: `Invoice created: ${invoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 201,
      data: invoice,
      message: "Invoice created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllInvoices = async (req, res, next) => {
  try {
    const { companyId, status, startDate, endDate } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllInvoices");
    }

    let invoices;

    if (startDate && endDate) {
      invoices = await getInvoicesByDateRangeRepo(companyId, startDate, endDate);
    } else {
      const filter = { companyId };
      if (status) filter.status = status;
      invoices = await getInvoicesRepo(filter);
    }

    new ApiResponse({
      statusCode: 200,
      data: invoices,
      message: "Invoices retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Invoice ID is required", 400, "getInvoiceById");
    }

    const invoice = await getInvoiceByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: invoice,
      message: "Invoice retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Invoice ID is required", 400, "updateInvoice");
    }

    const oldInvoice = await getInvoiceByIdRepo(id);

    const updatedInvoice = await updateInvoiceRepo(id, {
      ...updateData,
      updatedBy: req.user?.id,
    });

    await createAuditLog({
      companyId: oldInvoice.companyId,
      entityType: "Invoice",
      entityId: id,
      action: "UPDATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: updateData,
      oldValues: oldInvoice,
      description: `Invoice updated: ${oldInvoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedInvoice,
      message: "Invoice updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Invoice ID is required", 400, "deleteInvoice");
    }

    const invoice = await getInvoiceByIdRepo(id);

    await deleteInvoiceRepo(id);

    // Update PO to remove invoice reference
    if (invoice.linkedPO) {
      const po = await getPurchaseOrderByIdRepo(invoice.linkedPO);
      const invoiceIds = po.invoiceIds.filter((id) => id.toString() !== invoice._id.toString());
      await updatePurchaseOrderRepo(invoice.linkedPO, {
        invoiceIds,
        totalInvoicedAmount:
          Math.max(0, (po.totalInvoicedAmount || 0) - invoice.invoiceAmount) || 0,
        updatedBy: req.user?.id,
      });
    }

    await createAuditLog({
      companyId: invoice.companyId,
      entityType: "Invoice",
      entityId: id,
      action: "DELETE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: invoice,
      description: `Invoice deleted: ${invoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Invoice deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceByNumber = async (req, res, next) => {
  try {
    const { invoiceNo, companyId } = req.query;

    if (!invoiceNo || !companyId) {
      throw new AppError("invoiceNo and companyId are required", 400, "getInvoiceByNumber");
    }

    const invoice = await getInvoiceByNumberRepo(invoiceNo, companyId);

    new ApiResponse({
      statusCode: 200,
      data: invoice,
      message: "Invoice retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoicesByPO = async (req, res, next) => {
  try {
    const { poId } = req.params;

    if (!poId) {
      throw new AppError("Purchase Order ID is required", 400, "getInvoicesByPO");
    }

    const invoices = await getInvoicesByPORepo(poId);

    new ApiResponse({
      statusCode: 200,
      data: invoices,
      message: "Invoices for Purchase Order retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getInvoiceStats = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getInvoiceStats");
    }

    const stats = await getInvoiceStatsRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: stats,
      message: "Invoice statistics retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPendingApprovals = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getPendingApprovals");
    }

    const invoices = await getInvoicePendingApprovalRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: invoices,
      message: "Pending invoices retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const approveInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalComments } = req.body;

    if (!id) {
      throw new AppError("Invoice ID is required", 400, "approveInvoice");
    }

    const invoice = await getInvoiceByIdRepo(id);

    const updateData = {
      approvalStatus: "Approved",
      status: "POSTED",
      approvedBy: req.user?.id,
      approvalDate: new Date(),
      approvalComments,
      updatedBy: req.user?.id,
    };

    const approvedInvoice = await updateInvoiceRepo(id, updateData);

    await createAuditLog({
      companyId: invoice.companyId,
      entityType: "Invoice",
      entityId: id,
      action: "APPROVE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: updateData,
      description: `Invoice approved: ${invoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: approvedInvoice,
      message: "Invoice approved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const rejectInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalComments } = req.body;

    if (!id) {
      throw new AppError("Invoice ID is required", 400, "rejectInvoice");
    }

    const invoice = await getInvoiceByIdRepo(id);

    const updateData = {
      approvalStatus: "Rejected",
      status: "DRAFT",
      approvedBy: req.user?.id,
      approvalDate: new Date(),
      approvalComments,
      updatedBy: req.user?.id,
    };

    const rejectedInvoice = await updateInvoiceRepo(id, updateData);

    await createAuditLog({
      companyId: invoice.companyId,
      entityType: "Invoice",
      entityId: id,
      action: "REJECT",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: updateData,
      description: `Invoice rejected: ${invoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: rejectedInvoice,
      message: "Invoice rejected successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paidAmount, tdsAmount, paymentDate, reference } = req.body;

    if (!id || !paidAmount) {
      throw new AppError("Invoice ID and paidAmount are required", 400, "recordPayment");
    }

    const invoice = await getInvoiceByIdRepo(id);

    const updatedInvoice = await updateInvoicePaymentRepo(id, paidAmount, tdsAmount || 0);

    await createAuditLog({
      companyId: invoice.companyId,
      entityType: "Invoice",
      entityId: id,
      action: "UPDATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: {
        paidAmount,
        tdsAmount,
        paymentDate,
        reference,
      },
      description: `Payment recorded on Invoice: ${invoice.invoiceNo}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedInvoice,
      message: "Payment recorded successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const exportInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = "pdf" } = req.query;

    if (!["pdf", "word", "both"].includes(format)) {
      throw new AppError("Invalid export format. Use: pdf, word, both", 400, "exportInvoiceById");
    }

    const invoice = await getInvoiceByIdRepo(id);
    if (!invoice) {
      throw new AppError("Invoice not found", 404, "exportInvoiceById");
    }

    const result = await exportInvoice(invoice, format, "./uploads/exports");

    // Audit log
    await createAuditLog({
      companyId: invoice.companyId,
      entityType: "Invoice",
      entityId: invoice._id,
      action: "EXPORT",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: { format },
      description: `Invoice ${invoice.invoiceNo} exported as ${format}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: result,
      message: `Invoice exported successfully as ${format}`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const exportInvoiceListEndpoint = async (req, res, next) => {
  try {
    const { companyId } = req.query;
    const { format = "csv" } = req.query;

    if (!companyId) {
      throw new AppError("Company ID is required", 400, "exportInvoiceListEndpoint");
    }

    if (!["csv", "pdf"].includes(format)) {
      throw new AppError("Invalid export format. Use: csv, pdf", 400, "exportInvoiceListEndpoint");
    }

    const invoices = await getInvoicesRepo(companyId);

    if (!invoices || invoices.length === 0) {
      throw new AppError("No invoices found to export", 404, "exportInvoiceListEndpoint");
    }

    const result = await exportInvoiceList(invoices, format, "./uploads/exports");

    // Audit log
    await createAuditLog({
      companyId,
      entityType: "Invoice",
      action: "EXPORT",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: { format, count: invoices.length },
      description: `Exported ${invoices.length} invoices as ${format}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: result,
      message: `${invoices.length} invoices exported successfully`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Create invoice with automatic journal entry using cross-database transaction
 * Ensures ACID compliance across invoice_db and accounting_db
 */
export const createInvoiceWithJournal = async (req, res, next) => {
  try {
    const {
      linkedPO,
      invoiceDate,
      dueDate,
      billTo,
      shipTo,
      items,
      companyId,
      notes,
      createJournalEntry = false,
      journalDescription,
    } = req.body;

    if (!invoiceDate || !dueDate || !billTo || !shipTo || !items || items.length === 0 || !companyId) {
      throw new AppError(
        "Missing required fields: invoiceDate, dueDate, billTo, shipTo, items, companyId",
        400,
        "createInvoiceWithJournal"
      );
    }

    // Calculate totals
    let totalTaxableValue = 0;
    let totalCGSTAmount = 0;
    let totalSGSTAmount = 0;
    let totalIGSTAmount = 0;
    let totalGSTAmount = 0;
    let invoiceAmount = 0;

    items.forEach((item) => {
      totalTaxableValue += item.taxableValue || 0;
      totalCGSTAmount += item.cgstAmount || 0;
      totalSGSTAmount += item.sgstAmount || 0;
      totalIGSTAmount += item.igstAmount || 0;
      totalGSTAmount += item.gstAmount || 0;
      invoiceAmount += item.totalAmount || 0;
    });

    const invoiceNumber = await generateInvoiceNumber(companyId);

    const invoiceData = {
      companyId,
      invoiceNo: invoiceNumber,
      linkedPO,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      billTo,
      shipTo,
      items,
      totalTaxableValue,
      totalCGSTAmount,
      totalSGSTAmount,
      totalIGSTAmount,
      totalGSTAmount,
      invoiceAmount,
      amountDue: invoiceAmount,
      netPayable: invoiceAmount,
      remainingAmount: invoiceAmount,
      valueInWords: `${invoiceAmount} only`,
      notes,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    };

    // If journal entry is requested, use transaction manager for atomic operations
    if (createJournalEntry) {
      const result = await transactionManager.createInvoiceWithJournal(
        async (data) => {
          // Step 1: Create invoice
          const invoice = await createInvoiceRepo(data);
          return invoice;
        },
        async (invoiceId, data) => {
          // Step 2: Create journal entry
          const journalData = {
            companyId,
            date: new Date(invoiceDate),
            journalNumber: `JNL-${invoiceNumber}`,
            description: journalDescription || `Auto-generated from Invoice ${invoiceNumber}`,
            reference: {
              type: "Invoice",
              id: invoiceId,
              number: invoiceNumber,
            },
            debitAmount: invoiceAmount,
            creditAmount: 0,
            status: "draft",
            createdBy: req.user?.id,
            updatedBy: req.user?.id,
          };

          const journal = await createJournalRepo(journalData);
          return journal;
        },
        async (invoiceId, journalId) => {
          // Step 3: Update invoice with journal reference
          await updateInvoiceRepo(invoiceId, {
            salesJournalId: journalId,
            accountingStatus: "journal_posted",
            updatedBy: req.user?.id,
          });
        },
        invoiceData
      );

      // Get the created invoice
      const createdInvoice = await getInvoiceByIdRepo(result.executedSteps[0].result._id);

      // Audit log for transaction
      await createAuditLog({
        companyId,
        entityType: "Invoice",
        entityId: createdInvoice._id,
        action: "CREATE_WITH_JOURNAL",
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        changes: { invoiceData, transactionId: result.transactionId },
        description: `Invoice created with automatic journal entry: ${createdInvoice.invoiceNo}`,
      });

      new ApiResponse({
        statusCode: 201,
        data: {
          invoice: createdInvoice,
          transactionId: result.transactionId,
          transaction: result,
        },
        message: "Invoice created with journal entry successfully (transactional)",
      }).send(res);
    } else {
      // Regular invoice creation without transaction
      const invoice = await createInvoiceRepo(invoiceData);

      // Update PO if linked
      if (linkedPO) {
        const po = await getPurchaseOrderByIdRepo(linkedPO);
        await updatePurchaseOrderRepo(linkedPO, {
          invoiceIds: [...(po.invoiceIds || []), invoice._id],
          totalInvoicedAmount: (po.totalInvoicedAmount || 0) + invoiceAmount,
          updatedBy: req.user?.id,
        });
      }

      await createAuditLog({
        companyId,
        entityType: "Invoice",
        entityId: invoice._id,
        action: "CREATE",
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        changes: invoiceData,
        description: `Invoice created: ${invoice.invoiceNo}`,
      });

      new ApiResponse({
        statusCode: 201,
        data: invoice,
        message: "Invoice created successfully",
      }).send(res);
    }
  } catch (error) {
    next(error);
  }
};
