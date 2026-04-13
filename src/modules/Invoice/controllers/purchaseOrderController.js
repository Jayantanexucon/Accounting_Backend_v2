import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  createPurchaseOrderRepo,
  getPurchaseOrderByIdRepo,
  getPurchaseOrdersRepo,
  getPurchaseOrderByNumberRepo,
  updatePurchaseOrderRepo,
  deletePurchaseOrderRepo,
  getPOsByStatusRepo,
  getPOsWithInvoiceProgressRepo,
} from "../repos/purchaseOrderRepo.js";

const generatePONumber = async (companyId) => {
  const timestamp = Date.now();
  return `PO-${companyId.toString().slice(-4)}-${timestamp}`;
};

// Map the new paymentTerms value to the legacy billingModel field
const billingModelMap = {
  milestone: "milestone",
  monthly: "fixed",
  hourly: "hourly",
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      poDate,
      deliveryDate,
      poCategory,
      billingModel,
      direction,
      paymentTerms,
      vendor,
      deliverTo,
      items,
      companyId,
      notes,
      milestones,
      resources,
      poreferencevalue,
      paymentSchedule,
      staffingConfig,
      withSignature,
    } = req.body;

    // ── Totals ────────────────────────────────────────────────────
    let totalTaxableValue = 0;
    let totalGSTAmount = 0;
    let totalAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item) => {
        totalTaxableValue += Number(item.taxableValue) || 0;
        totalGSTAmount += Number(item.gstAmount) || 0;
        totalAmount += Number(item.totalAmount) || 0;
      });
    }

    // For milestone POs the totals are set at contract level, not item level
    if (paymentTerms === "milestone") {
      totalTaxableValue = Number(req.body.totalTaxableValue) || totalTaxableValue;
      totalGSTAmount = Number(req.body.totalGSTAmount) || totalGSTAmount;
      totalAmount = Number(req.body.totalAmount) || totalAmount;
    }

    // ── Milestone defaults ────────────────────────────────────────
    // Auto-assign milestoneNo and default status here in the controller
    // so we never rely on a pre-save hook (unreliable with getDatabase()).
    const normalizedMilestones = Array.isArray(milestones)
      ? milestones.map((m, index) => ({
        ...m,
        milestoneNo: m.milestoneNo || index + 1,
        status: m.status || "pending",
        amount: Number(m.amount) || 0,
      }))
      : [];

    const poNumber = await generatePONumber(companyId);

    const poData = {
      companyId,
      poNumber,
      poDate: new Date(poDate),
      deliveryDate: new Date(deliveryDate),

      // New fields
      direction: direction || "receivable",
      paymentTerms: paymentTerms || "monthly",

      // Legacy fields — kept for backward compat
      poCategory: poCategory || "project",
      billingModel: billingModel || billingModelMap[paymentTerms] || "fixed",

      vendor,
      deliverTo,

      // Items — hsnId comes as a String from frontend, stored as String
      items: Array.isArray(items) ? items.map((item) => ({
        ...item,
        hsnId: item.hsnId ? String(item.hsnId) : undefined,
        hsnSac: item.hsnSac || "",
        gstRate: Number(item.gstRate) || 0,
        gstAmount: Number(item.gstAmount) || 0,
        taxableValue: Number(item.taxableValue) || 0,
        totalAmount: Number(item.totalAmount) || 0,
      })) : [],

      milestones: normalizedMilestones,
      resources: Array.isArray(resources) ? resources : [],
      attendanceRecords: [],

      totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
      totalGSTAmount: Math.round(totalGSTAmount * 100) / 100,
      totalCGSTAmount: Number(req.body.totalCGSTAmount) || Math.round((totalGSTAmount / 2) * 100) / 100,
      totalSGSTAmount: Number(req.body.totalSGSTAmount) || Math.round((totalGSTAmount / 2) * 100) / 100,
      totalIGSTAmount: Number(req.body.totalIGSTAmount) || 0,
      totalAmount: Math.round(totalAmount * 100) / 100,
      valueInWords: req.body.valueInWords || `${totalAmount} only`,

      notes,
      withSignature: withSignature || false,

      ...(poreferencevalue && { poreferencevalue }),
      ...(paymentSchedule && { paymentSchedule }),
      ...(staffingConfig && { staffingConfig }),

      // Store user id as String — User lives in a different DB
      createdBy: req.user?.id ? String(req.user.id) : undefined,
      updatedBy: req.user?.id ? String(req.user.id) : undefined,
    };

    const po = await createPurchaseOrderRepo(poData);

    await createAuditLog({
      companyId,
      entityType: "PurchaseOrder",
      entityId: po._id,
      action: "CREATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: poData,
      description: `Purchase Order created: ${po.poNumber}`,
    });

    new ApiResponse({
      statusCode: 201,
      data: po,
      message: "Purchase Order created successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { companyId, status, direction, paymentTerms } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllPurchaseOrders");
    }

    const filter = { companyId };
    if (status) filter.status = status;
    if (direction) filter.direction = direction;
    if (paymentTerms) filter.paymentTerms = paymentTerms;

    const pos = await getPurchaseOrdersRepo(filter);

    new ApiResponse({
      statusCode: 200,
      data: pos,
      message: "Purchase Orders retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Purchase Order ID is required", 400, "getPurchaseOrderById");
    }

    const po = await getPurchaseOrderByIdRepo(id);

    new ApiResponse({
      statusCode: 200,
      data: po,
      message: "Purchase Order retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw new AppError("Purchase Order ID is required", 400, "updatePurchaseOrder");
    }

    const oldPO = await getPurchaseOrderByIdRepo(id);

    // Keep billingModel in sync with paymentTerms
    if (updateData.paymentTerms && !updateData.billingModel) {
      updateData.billingModel = billingModelMap[updateData.paymentTerms] || "fixed";
    }

    // Normalize milestones if present
    if (Array.isArray(updateData.milestones)) {
      updateData.milestones = updateData.milestones.map((m, index) => ({
        ...m,
        milestoneNo: m.milestoneNo || index + 1,
        status: m.status || "pending",
      }));
    }

    // Normalize hsnId to String on items
    if (Array.isArray(updateData.items)) {
      updateData.items = updateData.items.map((item) => ({
        ...item,
        hsnId: item.hsnId ? String(item.hsnId) : undefined,
      }));
    }

    const updatedPO = await updatePurchaseOrderRepo(id, {
      ...updateData,
      updatedBy: req.user?.id ? String(req.user.id) : undefined,
    });

    await createAuditLog({
      companyId: oldPO.companyId,
      entityType: "PurchaseOrder",
      entityId: id,
      action: "UPDATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: updateData,
      oldValues: oldPO,
      description: `Purchase Order updated: ${oldPO.poNumber}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: updatedPO,
      message: "Purchase Order updated successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Purchase Order ID is required", 400, "deletePurchaseOrder");
    }

    const po = await getPurchaseOrderByIdRepo(id);

    await deletePurchaseOrderRepo(id);

    await createAuditLog({
      companyId: po.companyId,
      entityType: "PurchaseOrder",
      entityId: id,
      action: "DELETE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: po,
      description: `Purchase Order deleted: ${po.poNumber}`,
    });

    new ApiResponse({
      statusCode: 200,
      data: null,
      message: "Purchase Order deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderByNumber = async (req, res, next) => {
  try {
    const { poNumber, companyId } = req.query;

    if (!poNumber || !companyId) {
      throw new AppError("poNumber and companyId are required", 400, "getPurchaseOrderByNumber");
    }

    const po = await getPurchaseOrderByNumberRepo(poNumber, companyId);

    new ApiResponse({
      statusCode: 200,
      data: po,
      message: "Purchase Order retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPOStats = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getPOStats");
    }

    const stats = await getPOsWithInvoiceProgressRepo(companyId);

    new ApiResponse({
      statusCode: 200,
      data: stats,
      message: "PO statistics retrieved successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPOsByStatus = async (req, res, next) => {
  try {
    const { companyId, status } = req.query;

    if (!companyId || !status) {
      throw new AppError("companyId and status are required", 400, "getPOsByStatus");
    }

    const pos = await getPOsByStatusRepo(companyId, status);

    new ApiResponse({
      statusCode: 200,
      data: pos,
      message: `Purchase Orders with status '${status}' retrieved successfully`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};