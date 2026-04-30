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

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      poDate,
      deliveryDate,
      poCategory,
      billingModel,
      paymentTerms,
      vendor,
      deliverTo,
      items,
      companyId,
      notes,
    } = req.body;

    if (!poDate || !deliveryDate || !vendor || !deliverTo || !items || items.length === 0 || !companyId) {
      throw new AppError(
        "Missing required fields: poDate, deliveryDate, vendor, deliverTo, items, companyId",
        400,
        "createPurchaseOrder"
      );
    }

    let totalTaxableValue = 0;
    let totalGSTAmount = 0;
    let totalAmount = 0;

    items.forEach((item) => {
      totalTaxableValue += item.taxableValue || 0;
      totalGSTAmount += item.gstAmount || 0;
      totalAmount += item.totalAmount || 0;
    });

    const poNumber = await generatePONumber(companyId);

    const poData = {
      companyId,
      poNumber,
      poDate: new Date(poDate),
      deliveryDate: new Date(deliveryDate),
      poCategory: poCategory || "general",
      billingModel: billingModel || "fixed",
      paymentTerms: paymentTerms || "net-30",
      vendor,
      deliverTo,
      items,
      totalTaxableValue,
      totalGSTAmount,
      totalAmount,
      valueInWords: `${totalAmount} only`,
      notes,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
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
    const { companyId, status } = req.query;

    if (!companyId) {
      throw new AppError("companyId is required", 400, "getAllPurchaseOrders");
    }

    const filter = { companyId };
    if (status) filter.status = status;

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

    const updatedPO = await updatePurchaseOrderRepo(id, {
      ...updateData,
      updatedBy: req.user?.id,
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
