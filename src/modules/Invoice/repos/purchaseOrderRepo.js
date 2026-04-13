import AppError from "../../../utils/AppError.js";
import { getPurchaseOrderModel } from "../models/PurchaseOrder.js";

export const createPurchaseOrderRepo = async (poData) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.create(poData);
    return po;
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "createPurchaseOrderRepo");
    }
    if (error.code === 11000) {
      throw new AppError("Purchase Order number already exists", 400, "createPurchaseOrderRepo");
    }
    throw new AppError(error.message || "Failed to create PO", 500, "createPurchaseOrderRepo");
  }
};

export const getPurchaseOrderByIdRepo = async (id) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.findById(id).lean();

    if (!po) {
      throw new AppError("Purchase Order not found", 404, "getPurchaseOrderByIdRepo");
    }
    if (po) po.client = po.vendor;
    return po;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Error retrieving PO", 500, "getPurchaseOrderByIdRepo");
  }
};

export const getPurchaseOrdersRepo = async (filter = {}, options = {}) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const { sort = { poDate: -1 }, limit = 0, skip = 0 } = options;

    const pos = await PurchaseOrder.find(filter)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    return pos.map(po => ({ ...po, client: po.vendor }));
  } catch (error) {
    throw new AppError(error.message || "Error retrieving POs", 500, "getPurchaseOrdersRepo");
  }
};

export const getPurchaseOrderByNumberRepo = async (poNumber, companyId) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.findOne({ poNumber, companyId }).lean();

    if (!po) {
      throw new AppError("Purchase Order not found with this number", 404, "getPurchaseOrderByNumberRepo");
    }
    return po;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Error retrieving PO by number", 500, "getPurchaseOrderByNumberRepo");
  }
};

export const updatePurchaseOrderRepo = async (id, updateData) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.findByIdAndUpdate(id, updateData, { new: true });

    if (!po) {
      throw new AppError("Purchase Order not found", 404, "updatePurchaseOrderRepo");
    }
    if (po) po.client = po.vendor;
    return po;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el) => el.message);
      throw new AppError(messages.join(", "), 400, "updatePurchaseOrderRepo");
    }
    throw new AppError(error.message || "Failed to update PO", 500, "updatePurchaseOrderRepo");
  }
};

export const deletePurchaseOrderRepo = async (id) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.findByIdAndDelete(id);

    if (!po) {
      throw new AppError("Purchase Order not found", 404, "deletePurchaseOrderRepo");
    }
    return po;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Failed to delete PO", 500, "deletePurchaseOrderRepo");
  }
};

export const getPOsByStatusRepo = async (companyId, status, options = {}) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const { sort = { poDate: -1 }, limit = 0, skip = 0 } = options;

    const pos = await PurchaseOrder.find({ companyId, status })
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    return pos.map(po => ({ ...po, client: po.vendor }));
  } catch (error) {
    throw new AppError(error.message || "Error retrieving POs by status", 500, "getPOsByStatusRepo");
  }
};

export const getPOsWithInvoiceProgressRepo = async (companyId) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const stats = await PurchaseOrder.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalInvoiced: { $sum: "$totalInvoicedAmount" },
          totalPaid: { $sum: "$totalPaidAmount" },
        },
      },
    ]);

    return stats;
  } catch (error) {
    throw new AppError(
      error.message || "Error retrieving PO statistics",
      500,
      "getPOsWithInvoiceProgressRepo"
    );
  }
};

export const updatePOInvoiceProgress = async (poId, invoiceAmount) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    const po = await PurchaseOrder.findById(poId);

    if (!po) {
      throw new AppError("Purchase Order not found", 404, "updatePOInvoiceProgress");
    }

    po.totalInvoicedAmount = (po.totalInvoicedAmount || 0) + invoiceAmount;

    // Update status based on invoiced amount
    if (po.totalInvoicedAmount >= po.totalAmount) {
      po.status = "FULLY_INVOICED";
    } else if (po.totalInvoicedAmount > 0) {
      po.status = "PARTIALLY_INVOICED";
    }

    await po.save();
    return po;
  } catch (error) {
    if (error.statusCode === 404) throw error;
    throw new AppError(error.message || "Failed to update PO invoice progress", 500, "updatePOInvoiceProgress");
  }
};
