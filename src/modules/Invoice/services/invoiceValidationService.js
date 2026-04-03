import AppError from "../../../utils/AppError.js";
import { getPurchaseOrderByIdRepo } from "../repos/purchaseOrderRepo.js";

export const validateInvoiceAgainstPO = async (invoiceData, poId) => {
  try {
    if (!poId) {
      return {
        valid: true,
        warnings: ["Invoice not linked to a Purchase Order"],
      };
    }

    const purchaseOrder = await getPurchaseOrderByIdRepo(poId);

    if (!purchaseOrder) {
      throw new AppError("Purchase Order not found", 404, "validateInvoiceAgainstPO");
    }

    if (purchaseOrder.status === "CLOSED") {
      throw new AppError(
        "Cannot invoice against a closed Purchase Order",
        400,
        "validateInvoiceAgainstPO"
      );
    }

    const errors = [];
    const warnings = [];

    // Validate invoice items against PO items
    if (invoiceData.items && invoiceData.items.length > 0) {
      invoiceData.items.forEach((invoiceItem) => {
        const poItem = purchaseOrder.items.find(
          (item) => item._id.toString() === invoiceItem.poLineItemId?.toString()
        );

        if (!poItem) {
          errors.push(
            `Invoice item with PO Line ID ${invoiceItem.poLineItemId} not found in Purchase Order`
          );
          return;
        }

        // Check if invoiced quantity exceeds PO quantity
        const totalInvoicedQty = (poItem.invoicedQuantity || 0) + (invoiceItem.quantity || 0);
        if (totalInvoicedQty > poItem.quantity) {
          errors.push(
            `Invoice quantity (${invoiceItem.quantity}) + previously invoiced (${poItem.invoicedQuantity}) exceeds PO quantity (${poItem.quantity}) for item ${poItem.description}`
          );
        }

        // Warn if rate differs from PO rate (allows for minor discrepancies)
        if (invoiceItem.rate && poItem.rate) {
          const rateDifference = Math.abs(invoiceItem.rate - poItem.rate);
          const percentDifference = (rateDifference / poItem.rate) * 100;

          if (percentDifference > 5) {
            warnings.push(
              `Invoice item rate (${invoiceItem.rate}) differs from PO rate (${poItem.rate}) by ${percentDifference.toFixed(2)}% for item ${poItem.description}`
            );
          }
        }
      });
    }

    if (errors.length > 0) {
      throw new AppError(errors.join("; "), 400, "validateInvoiceAgainstPO");
    }

    return {
      valid: true,
      warnings,
      poValidationDetails: {
        poNumber: purchaseOrder.poNumber,
        poStatus: purchaseOrder.status,
        totalPOAmount: purchaseOrder.totalAmount,
        totalInvoicedAmount: purchaseOrder.totalInvoicedAmount || 0,
        remainingAmount: purchaseOrder.totalAmount - (purchaseOrder.totalInvoicedAmount || 0),
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "validateInvoiceAgainstPO");
  }
};

export const validateInvoiceTotals = (invoiceData) => {
  try {
    const errors = [];
    const warnings = [];

    if (!invoiceData.items || invoiceData.items.length === 0) {
      throw new AppError("Invoice must have at least one item", 400, "validateInvoiceTotals");
    }

    let calculatedTaxableValue = 0;
    let calculatedCGST = 0;
    let calculatedSGST = 0;
    let calculatedIGST = 0;
    let calculatedGST = 0;
    let calculatedInvoiceAmount = 0;

    invoiceData.items.forEach((item, index) => {
      if (!item.quantity || !item.rate) {
        errors.push(
          `Item ${index + 1}: quantity and rate are required`
        );
        return;
      }

      const itemTaxableValue = (item.quantity || 0) * (item.rate || 0);
      const gstRate = item.gstRate || 0;

      if (gstRate < 0 || gstRate > 100) {
        errors.push(
          `Item ${index + 1}: GST rate must be between 0 and 100`
        );
        return;
      }

      const itemGST = (itemTaxableValue * gstRate) / 100;
      const itemCGST = (item.cgstRate || 0) > 0 ? (itemTaxableValue * (item.cgstRate || 0)) / 100 : 0;
      const itemSGST = (item.sgstRate || 0) > 0 ? (itemTaxableValue * (item.sgstRate || 0)) / 100 : 0;
      const itemIGST = (item.igstRate || 0) > 0 ? (itemTaxableValue * (item.igstRate || 0)) / 100 : 0;

      calculatedTaxableValue += itemTaxableValue;
      calculatedCGST += itemCGST;
      calculatedSGST += itemSGST;
      calculatedIGST += itemIGST;
      calculatedGST += itemGST;
      calculatedInvoiceAmount += itemTaxableValue + itemGST;
    });

    // Validate provided totals with calculated totals (allow 1% tolerance for rounding)
    const tolerance = calculatedTaxableValue * 0.01;

    if (
      invoiceData.totalTaxableValue &&
      Math.abs(invoiceData.totalTaxableValue - calculatedTaxableValue) > tolerance
    ) {
      warnings.push(
        `Provided totalTaxableValue (${invoiceData.totalTaxableValue}) differs from calculated (${calculatedTaxableValue.toFixed(2)})`
      );
    }

    if (
      invoiceData.totalGSTAmount &&
      Math.abs(invoiceData.totalGSTAmount - calculatedGST) > tolerance
    ) {
      warnings.push(
        `Provided totalGSTAmount (${invoiceData.totalGSTAmount}) differs from calculated (${calculatedGST.toFixed(2)})`
      );
    }

    if (
      invoiceData.invoiceAmount &&
      Math.abs(invoiceData.invoiceAmount - calculatedInvoiceAmount) > tolerance
    ) {
      warnings.push(
        `Provided invoiceAmount (${invoiceData.invoiceAmount}) differs from calculated (${calculatedInvoiceAmount.toFixed(2)})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      calculatedTotals: {
        taxableValue: calculatedTaxableValue,
        cgstAmount: calculatedCGST,
        sgstAmount: calculatedSGST,
        igstAmount: calculatedIGST,
        gstAmount: calculatedGST,
        invoiceAmount: calculatedInvoiceAmount,
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "validateInvoiceTotals");
  }
};

export const validatePOCanBeInvoiced = async (poId) => {
  try {
    const purchaseOrder = await getPurchaseOrderByIdRepo(poId);

    if (!purchaseOrder) {
      throw new AppError("Purchase Order not found", 404, "validatePOCanBeInvoiced");
    }

    const allowedStatuses = ["OPEN", "PARTIALLY_INVOICED"];

    if (!allowedStatuses.includes(purchaseOrder.status)) {
      throw new AppError(
        `Cannot create invoice for PO with status ${purchaseOrder.status}. Allowed statuses: ${allowedStatuses.join(", ")}`,
        400,
        "validatePOCanBeInvoiced"
      );
    }

    return {
      valid: true,
      poDetails: {
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status,
        totalAmount: purchaseOrder.totalAmount,
        totalInvoicedAmount: purchaseOrder.totalInvoicedAmount || 0,
        remainingAmount: purchaseOrder.totalAmount - (purchaseOrder.totalInvoicedAmount || 0),
        totalItems: purchaseOrder.items?.length || 0,
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "validatePOCanBeInvoiced");
  }
};

export const validatePaymentAmount = async (invoiceId, paidAmount) => {
  try {
    const { getInvoiceByIdRepo } = await import("../repos/invoiceRepo.js");
    const invoice = await getInvoiceByIdRepo(invoiceId);

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "validatePaymentAmount");
    }

    if (paidAmount > invoice.amountDue) {
      return {
        valid: false,
        error: `Payment amount (${paidAmount}) exceeds invoice due amount (${invoice.amountDue})`,
        invoiceDetails: {
          invoiceNo: invoice.invoiceNo,
          invoiceAmount: invoice.invoiceAmount,
          paidAmount: invoice.paidAmount || 0,
          amountDue: invoice.amountDue,
        },
      };
    }

    const newPaidAmount = (invoice.paidAmount || 0) + paidAmount;
    const isFullyPaid = newPaidAmount >= invoice.invoiceAmount;

    return {
      valid: true,
      isFullyPaid,
      paymentDetails: {
        invoiceNo: invoice.invoiceNo,
        invoiceAmount: invoice.invoiceAmount,
        previouslyPaidAmount: invoice.paidAmount || 0,
        newPaymentAmount: paidAmount,
        totalPaidAmount: newPaidAmount,
        remainingAmount: invoice.invoiceAmount - newPaidAmount,
      },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "validatePaymentAmount");
  }
};
