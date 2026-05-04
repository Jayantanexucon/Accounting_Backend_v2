import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

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
    clientId: {
      type: String,
    },
    amountPaid: {
      type: Number,
      required: [true, "Amount paid is required"],
    },
    originalAmount: {
      type: Number,
      default: 0,
    },
    receivedAmount: {
      type: Number,
      default: 0,
    },
    adjustmentAmount: {
      type: Number,
      default: 0,
    },
    adjustmentType: {
      type: String,
      enum: [
        "NONE",
        "BANK_CHARGES",
        "PAYMENT_GATEWAY_CHARGES",
        "FOREX_LOSS",
        "FOREX_GAIN",
        "EXTRA_RECEIPT",
      ],
      default: "NONE",
    },
    adjustmentLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
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
      type: String,
      required: true,
    },
    isReconciled: {
      type: Boolean,
      default: false,
    },
    isReversed: {
      type: Boolean,
      default: false,
    },
    reversalJournalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      default: null,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-reconciliation hook
paymentSchema.post("save", async function (doc) {
  try {
    if (doc.status === "COMPLETED" && doc.journalId) {
      const { BankReconciliationService } = await import("../services/bankReconciliationService.js");
      const { getBankLedgerTransactionModel } = await import("./BankLedgerTransaction.js");
      const BankLedgerTransaction = await getBankLedgerTransactionModel();

      const ledgerTransactions = await BankLedgerTransaction.find({
        companyId: doc.companyId,
        journalId: doc.journalId,
        reconciliationStatus: { $ne: "MATCHED" },
      }).lean();

      for (const ledgerTx of ledgerTransactions) {
        await BankReconciliationService.autoReconcile(ledgerTx._id);
      }
    }
  } catch (error) {
    console.error("Auto-reconciliation hook failed for Payment:", error.message);
  }
});

paymentSchema.index({ companyId: 1, invoiceId: 1 });
paymentSchema.index({ paymentDate: -1, status: 1 });
paymentSchema.index({ clientId: 1, paymentDate: -1 });

export const getPaymentModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Payment || db.model("Payment", paymentSchema);
};
