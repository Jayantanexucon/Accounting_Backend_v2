import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createPaymentRepo,
  getPaymentByIdRepo,
  getPaymentsRepo,
  updatePaymentRepo,
  deletePaymentRepo,
  getPaymentsByClientRepo,
  getPaymentsByInvoiceRepo,
  getPaymentStatsByStatusRepo,
  getPendingReconciledPaymentsRepo,
  getTDSReportDataRepo,
} from "../repos/paymentRepo.js";

export const createPayment = async (req, res, next) => {
  try {
    const {
      invoiceId,
      companyId,
      clientId,
      amountPaid,
      tdsAmount,
      tdsRate,
      tdsSection,
      grossAmount,
      paymentMode,
      paymentDate,
      reference,
      notes,
    } = req.body;

    if (!invoiceId || !companyId || (!amountPaid && !tdsAmount) || !paymentMode) {
      throw new AppError(
        "Missing required fields: invoiceId, companyId, payment amount or TDS amount, paymentMode",
        400,
        "createPayment"
      );
    }

    const paymentData = {
      invoiceId,
      companyId,
      clientId,
      amountPaid,
      tdsAmount: tdsAmount || 0,
      tdsRate: tdsRate || 0,
      tdsSection,
      grossAmount: grossAmount || amountPaid,
      paymentMode,
      paymentDate: new Date(paymentDate || new Date()),
      reference,
      notes,
      status: "PENDING",
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    };

    const payment = await createPaymentRepo(paymentData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Payment",
      entityId: payment._id,
      action: "CREATE",
      changes: paymentData,
      companyId,
    });

    new ApiResponse({
      statusCode: 201,
      data: payment,
      message: "Payment created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllPayments = async (req, res, next) => {
  try {
    const { companyId, status, clientId, startDate, endDate } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllPayments");
    }

    const filter = { companyId };
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;

    if (startDate && endDate) {
      filter.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const payments = await getPaymentsRepo(filter);

    new ApiResponse({
      statusCode: 200,
      data: payments,
      message: "Payments retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Payment ID is required", 400, "getPaymentById");
    }

    const payment = await getPaymentByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: payment,
      message: "Payment retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPaymentsByClient = async (req, res, next) => {
  try {
    const { clientId, companyId } = req.query;

    if (!clientId || !companyId) {
      throw new AppError("clientId and companyId are required", 400, "getPaymentsByClient");
    }

    const payments = await getPaymentsByClientRepo(clientId, companyId);

    new ApiResponse({
      statusCode: 200,
      data: payments,
      message: "Client payments retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPaymentsByInvoice = async (req, res, next) => {
  try {
    const { invoiceId, companyId } = req.query;

    if (!invoiceId || !companyId) {
      throw new AppError("invoiceId and companyId are required", 400, "getPaymentsByInvoice");
    }

    const payments = await getPaymentsByInvoiceRepo(invoiceId, companyId);

    new ApiResponse({
      statusCode: 200,
      data: payments,
      message: "Invoice payments retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Payment ID is required", 400, "updatePayment");
    }

    const oldPayment = await getPaymentByIdRepo(id);

    const updatedPayment = await updatePaymentRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Payment",
      entityId: id,
      action: "UPDATE",
      changes: updateData,
      oldValues: oldPayment,
      companyId: oldPayment.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedPayment,
      message: "Payment updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Payment ID is required", 400, "deletePayment");
    }

    const payment = await getPaymentByIdRepo(id);

    await deletePaymentRepo(id);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Payment",
      entityId: id,
      action: "DELETE",
      changes: payment,
      companyId: payment.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Payment deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPaymentStats = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getPaymentStats");
    }

    const stats = await getPaymentStatsByStatusRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: stats,
      message: "Payment stats retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const reconcilePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reconciledAmount, reconciliationNotes } = req.body;

    if (!id) {
      throw new AppError("Payment ID is required", 400, "reconcilePayment");
    }

    const payment = await getPaymentByIdRepo(id);

    const updateData = {
      status: "COMPLETED",
      reconciliationStatus: "RECONCILED",
      reconciledAmount: reconciledAmount || payment.amountPaid,
      reconciliationNotes,
    };

    const reconciledPayment = await updatePaymentRepo(id, updateData);

    await createAuditLog({
      userId: req.user?.id,
      entityType: "Payment",
      entityId: id,
      action: "RECONCILE",
      changes: updateData,
      companyId: payment.companyId,
    });

    new ApiResponse({
      statusCode: 200,
      data: reconciledPayment,
      message: "Payment reconciled successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPendingReconciliations = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getPendingReconciliations");
    }

    const payments = await getPendingReconciledPaymentsRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: payments,
      message: "Pending reconciliations retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getTDSReport = async (req, res, next) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    if (!companyId || !startDate || !endDate) {
      throw new AppError("companyId, startDate, and endDate are required", 400, "getTDSReport");
    }

    const tdsData = await getTDSReportDataRepo(companyId, startDate, endDate);

    new ApiResponse({
      statusCode: 200,
      data: tdsData,
      message: "TDS report retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
