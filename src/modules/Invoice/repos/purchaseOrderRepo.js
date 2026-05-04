import AppError from "../../../utils/AppError.js";
import { getPurchaseOrderModel } from "../models/PurchaseOrder.js";
import {
  buildTaxMeta,
  normalizeLineItemTax,
  round2,
} from "../utils/taxNormalization.js";

// Helper: Recalculate totalAmount for items if missing (data stored before fix)
const recalculateItemTotals = (po) => {
  if (!Array.isArray(po.items)) return po;

  // ── Derive gstSplit from PO-level tax data ─────────────────────────────
  // The repo doesn't have access to company/vendor state codes, but we can
  // infer the split from the saved taxSummary or legacy CGST/SGST/IGST totals.
  let gstSplit;
  if (Array.isArray(po.taxSummary) && po.taxSummary.length > 0) {
    const types = po.taxSummary.map((e) =>
      String(e?.taxType || e?.label || "").trim().toUpperCase()
    );
    if (types.includes("CGST") || types.includes("SGST")) gstSplit = "INTRA";
    else if (types.includes("IGST")) gstSplit = "INTER";
  }
  if (!gstSplit) {
    const hasCgstSgst = (po.totalCGSTAmount || 0) > 0 || (po.totalSGSTAmount || 0) > 0;
    const hasIgst = (po.totalIGSTAmount || 0) > 0;
    if (hasCgstSgst && !hasIgst) gstSplit = "INTRA";
    else if (hasIgst && !hasCgstSgst) gstSplit = "INTER";
  }

  let recalculated = false;
  const items = po.items.map((item, index) => {
    // ── Assign stable itemId if missing ─────────────────────────
    if (!item.itemId && !item._id) {
       item.itemId = `po-item-${index}`;
       recalculated = true;
    }

    // ── Recalculate totals ──────────────────────────────────────
    const normalizedTax = normalizeLineItemTax(item, {
      taxType: po.taxType,
      taxLabel: po.taxLabel,
      gstSplit,
    });
    const computedTotalAmount =
      Number(item.totalAmount || 0) ||
      round2(Number(item.taxableValue || 0) + Number(normalizedTax.taxAmount || 0));

    if (item.taxType !== normalizedTax.taxType ||
        item.taxLabel !== normalizedTax.taxLabel ||
        Number(item.taxRate ?? item.gstRate ?? 0) !== normalizedTax.taxRate ||
        Number(item.taxAmount ?? item.gstAmount ?? 0) !== normalizedTax.taxAmount ||
        Number(item.combinedTaxRate || 0) !== normalizedTax.combinedTaxRate ||
        JSON.stringify(item.taxBreakdown || []) !== JSON.stringify(normalizedTax.taxBreakdown || [])) {
      Object.assign(item, normalizedTax);
      recalculated = true;
    }

    if ((item.totalAmount === 0 || !item.totalAmount) && (item.taxableValue || normalizedTax.taxAmount)) {
      item.totalAmount = computedTotalAmount;
      recalculated = true;
    }
    return item;
  });

  // Recalculate PO-level totals if items were recalculated
  if (recalculated) {
    const totalTaxableValue = items.reduce((sum, item) => sum + Number(item.taxableValue || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const taxMeta = buildTaxMeta({
      taxType: po.taxType,
      taxLabel: po.taxLabel,
      taxSummary: po.taxSummary,
      totalTaxAmount: po.totalTaxAmount,
      items,
    });

    po.items = items;
    po.totalTaxableValue = round2(totalTaxableValue);
    po.taxType = taxMeta.taxType;
    po.taxLabel = taxMeta.taxLabel;
    po.taxSummary = taxMeta.taxSummary;
    po.totalTaxAmount = taxMeta.totalTaxAmount;
    po.totalGSTAmount = taxMeta.totalGSTAmount;
    po.totalCGSTAmount = taxMeta.totalCGSTAmount;
    po.totalSGSTAmount = taxMeta.totalSGSTAmount;
    po.totalIGSTAmount = taxMeta.totalIGSTAmount;
    po.totalAmount = round2(totalAmount);
  }

  return po;
};


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
    let po = await PurchaseOrder.findById(id).lean();

    if (!po) {
      throw new AppError("Purchase Order not found", 404, "getPurchaseOrderByIdRepo");
    }
    
    // Recalculate missing totals for old data
    po = recalculateItemTotals(po);
    
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

    let pos = await PurchaseOrder.find(filter)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    // Recalculate missing totals for old data
    pos = pos.map(po => {
      po = recalculateItemTotals(po);
      po.client = po.vendor;
      return po;
    });

    return pos;
  } catch (error) {
    throw new AppError(error.message || "Error retrieving POs", 500, "getPurchaseOrdersRepo");
  }
};

export const getPurchaseOrderByNumberRepo = async (poNumber, companyId) => {
  try {
    const PurchaseOrder = await getPurchaseOrderModel();
    let po = await PurchaseOrder.findOne({ poNumber, companyId }).lean();

    if (!po) {
      throw new AppError("Purchase Order not found with this number", 404, "getPurchaseOrderByNumberRepo");
    }
    
    // Recalculate missing totals for old data
    po = recalculateItemTotals(po);
    
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