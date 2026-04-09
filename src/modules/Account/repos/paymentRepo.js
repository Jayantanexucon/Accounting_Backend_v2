import AppError from "../../../utils/AppError.js";
import { getPaymentModel } from "../models/Payment.js";

export const createPaymentRepo = async (paymentData) => {
  try {
    const Payment = await getPaymentModel();
    return await Payment.create(paymentData);
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createPaymentRepo");
    }
    throw new AppError(error.message || "Failed to create payment", 500, "createPaymentRepo");
  }
};

export const getPaymentByIdRepo = async (id) => {
  try {
    const Payment = await getPaymentModel();
    const payment = await Payment.findById(id).populate("journalId").lean();

    if (!payment) {
      throw new AppError("Payment not found", 404, "getPaymentByIdRepo");
    }
    return payment;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Error retrieving payment", 500, "getPaymentByIdRepo");
  }
};

export const getPaymentsRepo = async (filter = {}, options = {}) => {
  try {
    const Payment = await getPaymentModel();
    const { sort = { paymentDate: -1 }, limit = 0, skip = 0 } = options;

    const payments = await Payment.find(filter)
      .populate("journalId")
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    return payments;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving payments", 500, "getPaymentsRepo");
  }
};

export const getPaymentsByClientRepo = async (clientId, companyId, options = {}) => {
  try {
    const Payment = await getPaymentModel();
    const { sort = { paymentDate: -1 }, limit = 0, skip = 0 } = options;

    const payments = await Payment.find({ clientId, companyId })
      .populate("journalId")
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    return payments;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving client payments", 500, "getPaymentsByClientRepo");
  }
};

export const getPaymentsByInvoiceRepo = async (invoiceId, companyId) => {
  try {
    const Payment = await getPaymentModel();
    const payments = await Payment.find({ invoiceId, companyId })
      .populate("journalId")
      .sort({ paymentDate: -1 })
      .lean();

    return payments;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving invoice payments",
      500,
      "getPaymentsByInvoiceRepo"
    );
  }
};

export const updatePaymentRepo = async (id, updateData) => {
  try {
    const Payment = await getPaymentModel();
    const payment = await Payment.findByIdAndUpdate(id, updateData, { new: true }).populate("journalId");

    if (!payment) {
      throw new AppError("Payment not found", 404, "updatePaymentRepo");
    }
    return payment;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "updatePaymentRepo");
    }
    throw new AppError(error.message || "Failed to update payment", 500, "updatePaymentRepo");
  }
};

export const deletePaymentRepo = async (id) => {
  try {
    const Payment = await getPaymentModel();
    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      throw new AppError("Payment not found", 404, "deletePaymentRepo");
    }
    return payment;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Failed to delete payment", 500, "deletePaymentRepo");
  }
};

export const getPaymentStatsByStatusRepo = async (companyId) => {
  try {
    const Payment = await getPaymentModel();
    const stats = await Payment.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amountPaid" },
          totalTDS: { $sum: "$tdsAmount" },
        },
      },
    ]);

    return stats;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving payment stats",
      500,
      "getPaymentStatsByStatusRepo"
    );
  }
};

export const getPendingReconciledPaymentsRepo = async (companyId, options = {}) => {
  try {
    const Payment = await getPaymentModel();
    const { limit = 0, skip = 0 } = options;

    const payments = await Payment.find({
      companyId,
      $or: [{ reconciliationStatus: "PENDING" }, { reconciliationStatus: null }],
    })
      .sort({ paymentDate: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return payments;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving pending reconciliation payments",
      500,
      "getPendingReconciledPaymentsRepo"
    );
  }
};

export const getTDSReportDataRepo = async (companyId, startDate, endDate) => {
  try {
    const Payment = await getPaymentModel();
    const tdsData = await Payment.aggregate([
      {
        $match: {
          companyId,
          paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
          tdsAmount: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$tdsSection",
          totalAmount: { $sum: "$amountPaid" },
          totalTDS: { $sum: "$tdsAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return tdsData;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving TDS report data",
      500,
      "getTDSReportDataRepo"
    );
  }
};
