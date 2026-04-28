import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import {
  generateWordDocument,
  generatePdfFromWord,
  formatDate,
  sendDocumentResponse,
} from "../../../utils/documentGenerator.js";
import {
  buildTaxMeta,
  normalizeLineItemTax,
  round2,
} from "../utils/taxNormalization.js";
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
import { getInvoicesByPORepo } from "../repos/invoiceRepo.js";
import { findCompanyByIdRepo } from "../../company/repos/companyRepo.js";

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

const normalizeStateCode = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "";
  const digitMatch = normalized.match(/^(\d{2})/);
  if (digitMatch) return digitMatch[1];
  const alphaMatch = normalized.match(/^([A-Z]{2})/);
  return alphaMatch ? alphaMatch[1] : normalized;
};

const getGstSplit = (fromAddress = {}, toAddress = {}) => {
  const fromStateCode = normalizeStateCode(fromAddress?.stateCode);
  const toStateCode = normalizeStateCode(toAddress?.stateCode);

  if (!fromStateCode || !toStateCode) return undefined;
  return fromStateCode === toStateCode ? "INTRA" : "INTER";
};

const getCompanyStateCode = (company = {}) =>
  normalizeStateCode(company?.taxDetails?.gstin || company?.registeredAddress?.stateCode);

const getPartyStateCode = (party = {}) =>
  normalizeStateCode(party?.GSTIN || party?.gstin || party?.stateCode);

const getCompanyBasedGstSplit = (company = {}, party = {}) => {
  const companyStateCode = getCompanyStateCode(company);
  const partyStateCode = getPartyStateCode(party);

  if (!companyStateCode || !partyStateCode) return undefined;
  return companyStateCode === partyStateCode ? "INTRA" : "INTER";
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

    const company = companyId ? await findCompanyByIdRepo(companyId) : null;

    // ── Totals ────────────────────────────────────────────────────
    let totalTaxableValue = 0;
    let totalAmount = 0;
    const gstSplit =
      getCompanyBasedGstSplit(company, vendor) || getGstSplit(vendor, deliverTo);
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => {
          const normalizedTax = normalizeLineItemTax(item, {
            taxType: req.body.taxType,
            taxLabel: req.body.taxLabel,
            gstSplit,
          });
          const taxableValue = Number(item.taxableValue) || 0;
          const totalAmountValue =
            Number(item.totalAmount) ||
            Number(item.total) ||
            taxableValue + Number(normalizedTax.taxAmount || normalizedTax.gstAmount || 0) ||
            0;

          totalTaxableValue += taxableValue;
          totalAmount += totalAmountValue;

          return {
            ...item,
            hsnId: item.hsnId ? String(item.hsnId) : undefined,
            hsnSac: item.hsnSac || "",
            unit: item.unit || "each",
            quantity: Number(item.quantity) || 0,
            rate: Number(item.rate) || 0,
            taxableValue,
            totalAmount: totalAmountValue,
            ...normalizedTax,
            // CRITICAL: Ensure all tax fields are aligned with recalculated normalized values
            taxRate: normalizedTax.taxRate,
            taxAmount: normalizedTax.taxAmount,
            gstRate: normalizedTax.gstRate,
            gstAmount: normalizedTax.gstAmount,
            combinedTaxRate: normalizedTax.combinedTaxRate,
          };
        })
      : [];

    const computedTaxMeta = buildTaxMeta({
      taxType: req.body.taxType,
      taxLabel: req.body.taxLabel,
      taxSummary: undefined, // Let it recalculate from items
      totalTaxAmount: undefined, // ← Don't pass frontend value, recalculate from items
      items: normalizedItems,
    });

    // For milestone POs the totals are set at contract level, not item level
    if (paymentTerms === "milestone") {
      totalTaxableValue = Number(req.body.totalTaxableValue) || totalTaxableValue;
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
      items: normalizedItems,

      milestones: normalizedMilestones,
      resources: Array.isArray(resources) ? resources : [],
      attendanceRecords: [],

      totalTaxableValue: round2(totalTaxableValue),
      taxType: computedTaxMeta.taxType,
      taxLabel: computedTaxMeta.taxLabel,
      taxSummary: computedTaxMeta.taxSummary,
      totalTaxAmount: computedTaxMeta.totalTaxAmount,
      totalGSTAmount: computedTaxMeta.totalGSTAmount,
      totalCGSTAmount: computedTaxMeta.totalCGSTAmount,
      totalSGSTAmount: computedTaxMeta.totalSGSTAmount,
      totalIGSTAmount: computedTaxMeta.totalIGSTAmount,
      totalAmount: round2(totalAmount),
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
      changes: [],
      newValues: po,
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

    // Fetch linked invoices and attach to PO
    const linkedInvoices = await getInvoicesByPORepo(id);
    po.linkedInvoices = linkedInvoices;

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
    const company = oldPO?.companyId ? await findCompanyByIdRepo(oldPO.companyId) : null;

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

    // Normalize hsnId to String on items and recalculate totals
    let totalTaxableValue = 0;
    let totalAmount = 0;
    
    if (Array.isArray(updateData.items)) {
      const gstSplit =
        getCompanyBasedGstSplit(company, updateData.vendor || oldPO.vendor) ||
        getGstSplit(updateData.vendor || oldPO.vendor, updateData.deliverTo || oldPO.deliverTo);
      
      updateData.items = updateData.items.map((item) => {
        const normalizedTax = normalizeLineItemTax(item, {
          taxType: updateData.taxType || oldPO.taxType,
          taxLabel: updateData.taxLabel || oldPO.taxLabel,
          gstSplit,
        });
        
        const taxableValue = Number(item.taxableValue) || 0;
        const totalAmountValue =
          Number(item.totalAmount) ||
          Number(item.total) ||
          taxableValue + Number(normalizedTax.taxAmount || normalizedTax.gstAmount || 0) ||
          0;

        totalTaxableValue += taxableValue;
        totalAmount += totalAmountValue;

        return {
          ...item,
          hsnId: item.hsnId ? String(item.hsnId) : undefined,
          taxableValue,
          totalAmount: totalAmountValue,
          ...normalizedTax,
          // CRITICAL: Ensure all tax fields are aligned with recalculated normalized values
          // These override any stale values from the request item
          taxRate: normalizedTax.taxRate,
          taxAmount: normalizedTax.taxAmount,
          gstRate: normalizedTax.gstRate,
          gstAmount: normalizedTax.gstAmount,
          combinedTaxRate: normalizedTax.combinedTaxRate,
        };
      });

      // Update totals in updateData so they get saved
      updateData.totalTaxableValue = round2(totalTaxableValue);
      updateData.totalAmount = round2(totalAmount);
    }

    // ── FIX: Always rebuild tax meta from items when items are present ──
    // This ensures PO-level totals (totalTaxAmount, totalCGSTAmount, etc.) are recalculated
    // and not left stale from previous save.
    if (Array.isArray(updateData.items)) {
      const taxMeta = buildTaxMeta({
        taxType: updateData.taxType || oldPO.taxType,
        taxLabel: updateData.taxLabel || oldPO.taxLabel,
        taxSummary: undefined, // Don't pass old summary, let it rebuild from items
        totalTaxAmount: undefined, // ← CRITICAL: Don't pass old amount, let it recalculate from items
        items: updateData.items || [], // Use freshly recalculated items
      });
      updateData.taxType = taxMeta.taxType;
      updateData.taxLabel = taxMeta.taxLabel;
      updateData.taxSummary = taxMeta.taxSummary;
      updateData.totalTaxAmount = taxMeta.totalTaxAmount;
      updateData.totalGSTAmount = taxMeta.totalGSTAmount;
      updateData.totalCGSTAmount = taxMeta.totalCGSTAmount;
      updateData.totalSGSTAmount = taxMeta.totalSGSTAmount;
      updateData.totalIGSTAmount = taxMeta.totalIGSTAmount;
    }

    const updatedPO = await updatePurchaseOrderRepo(id, {
      ...updateData,
      updatedBy: req.user?.id ? String(req.user.id) : undefined,
    });

    // Compute changes for audit log
    const changes = [];
    Object.keys(updateData).forEach(key => {
      if (JSON.stringify(oldPO[key]) !== JSON.stringify(updateData[key])) {
        changes.push({
          field: key,
          oldValue: oldPO[key],
          newValue: updateData[key],
        });
      }
    });

    await createAuditLog({
      companyId: oldPO.companyId,
      entityType: "PurchaseOrder",
      entityId: id,
      action: "UPDATE",
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      changes: changes,
      oldValues: oldPO,
      newValues: updatedPO,
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
      changes: [],
      oldValues: po,
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

// ============================================
// Download Functions
// ============================================

/**
 * Prepare purchase order data for template
 */
const preparePurchaseOrderData = (purchaseOrder) => {
  const data = {
    // Header
    PurchaseOrderNo: purchaseOrder.poNumber,
    poDate: formatDate(purchaseOrder.poDate),
    DueDate: formatDate(purchaseOrder.deliveryDate),
    purchaseorderreference: purchaseOrder.poreferencevalue || "",
    referenceDate: formatDate(purchaseOrder.referenceDate),
    Currency: purchaseOrder.currency || "INR",
    AmountDue: purchaseOrder.totalAmount?.toFixed(2) || "0.00",
    PaymentMode: purchaseOrder.paymentTerms || "",

    // Bill To / Ship To
    BillToClientName: purchaseOrder.vendor?.name || "",
    BillToAddress: purchaseOrder.vendor?.address || "",
    BillToStateCode: purchaseOrder.vendor?.stateCode || "",
    BillToGSTIN: purchaseOrder.vendor?.GSTIN || "",
    ShipToClientName: purchaseOrder.deliverTo?.name || "",
    ShipToAddress: purchaseOrder.deliverTo?.address || "",
    ShipToStateCode: purchaseOrder.deliverTo?.stateCode || "",
    ShipToGSTIN: purchaseOrder.deliverTo?.GSTIN || "",

    // Totals
    TotalTaxableValue: purchaseOrder.totalTaxableValue?.toFixed(2) || "0.00",
    ValueInFigure: purchaseOrder.valueInWords || "",
    CGST: purchaseOrder.totalCGSTAmount?.toFixed(2) || "0.00",
    SGST: purchaseOrder.totalSGSTAmount?.toFixed(2) || "0.00",
    IGST: purchaseOrder.totalIGSTAmount?.toFixed(2) || "0.00",

    // Items array for looping
    items: (purchaseOrder.items || []).map((item, idx) => ({
      index: idx + 1,
      description: item.description || "",
      hsnSac: item.hsnSac || "",
      quantity: item.quantity,
      rate: (item.rate || 0).toFixed(2),
      taxableValue: (item.taxableValue || 0).toFixed(2),
      gstRate: item.gstRate || 0,
      gstAmount: (item.gstAmount || 0).toFixed(2),
      total: (item.totalAmount || item.total || 0).toFixed(2),
    })),
  };
  return data;
};

/**
 * Download Purchase Order as Word document
 */
export const downloadWordPurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Purchase Order ID is required", 400, "downloadWordPurchaseOrder");
    }

    const purchaseOrder = await getPurchaseOrderByIdRepo(id);

    if (!purchaseOrder) {
      throw new AppError("Purchase Order not found", 404, "downloadWordPurchaseOrder");
    }

    const templateName = purchaseOrder.withSignature
      ? "PurchaseOrder-Template With Signature.docx"
      : "PurchaseOrder-Template Without Signature.docx";

    const templateData = preparePurchaseOrderData(purchaseOrder);
    const buffer = await generateWordDocument(templateName, templateData);

    sendDocumentResponse(
      res,
      buffer,
      `PurchaseOrder_${purchaseOrder.poNumber}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Download Purchase Order as PDF document
 */
export const downloadPdfPurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Purchase Order ID is required", 400, "downloadPdfPurchaseOrder");
    }

    const purchaseOrder = await getPurchaseOrderByIdRepo(id);

    if (!purchaseOrder) {
      throw new AppError("Purchase Order not found", 404, "downloadPdfPurchaseOrder");
    }

    const templateName = purchaseOrder.withSignature
      ? "PurchaseOrder-Template With Signature.docx"
      : "PurchaseOrder-Template Without Signature.docx";

    const templateData = preparePurchaseOrderData(purchaseOrder);
    const wordBuffer = await generateWordDocument(templateName, templateData);
    const pdfBuffer = await generatePdfFromWord(wordBuffer);

    sendDocumentResponse(
      res,
      pdfBuffer,
      `PurchaseOrder_${purchaseOrder.poNumber}.pdf`,
      "application/pdf"
    );
  } catch (error) {
    next(error);
  }
};
