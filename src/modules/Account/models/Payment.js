import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: [true, "Invoice ID is required"],
      indexed: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
      indexed: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
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
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
    },
    reconciledAmount: {
      type: Number,
      default: 0,
    },
    reconciliationStatus: {
      type: String,
      enum: ["NOT_RECONCILED", "PARTIALLY_RECONCILED", "FULLY_RECONCILED"],
      default: "NOT_RECONCILED",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ companyId: 1, invoiceId: 1 });
paymentSchema.index({ paymentDate: -1, status: 1 });
paymentSchema.index({ clientId: 1, paymentDate: -1 });

export const getPaymentModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Payment || db.model("Payment", paymentSchema);
};
