import mongoose from "mongoose";
import { connectAccountingDB } from "../../../config/db/accounting.db.js";

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: [true, "Invoice ID is required"],
      indexed: true,
    },
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      indexed: true,
    },
    clientId: String,
    amountPaid: {
      type: Number,
      required: [true, "Amount paid is required"],
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    tdsRate: {
      type: Number,
      default: 0,
    },
    tdsSection: String,
    grossAmount: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: [
        "BANK_TRANSFER",
        "CHEQUE",
        "CASH",
        "CREDIT_CARD",
        "DIGITAL_WALLET",
        "OTHER",
      ],
      required: [true, "Payment mode is required"],
    },
    paymentDate: {
      type: Date,
      required: [true, "Payment date is required"],
      indexed: true,
    },
    reference: String,
    notes: String,
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "CANCELLED", "RECONCILED"],
      default: "PENDING",
    },
    journalId: String,
    reconciledAmount: {
      type: Number,
      default: 0,
    },
    reconciliationStatus: {
      type: String,
      enum: ["NOT_RECONCILED", "PARTIALLY_RECONCILED", "FULLY_RECONCILED"],
      default: "NOT_RECONCILED",
    },
    createdBy: String,
    updatedBy: String,
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ companyId: 1, invoiceId: 1 });
paymentSchema.index({ paymentDate: -1, status: 1 });
paymentSchema.index({ clientId: 1, paymentDate: -1 });

export const getPaymentModel = async () => {
  const db = await connectAccountingDB();
  return db.models.Payment || db.model("Payment", paymentSchema);
};
