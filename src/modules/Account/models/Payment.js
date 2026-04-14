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
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-reconciliation hook
paymentSchema.post("save", async function (doc, next) {
  try {
    // Only attempt reconciliation for Completed payments
    if (doc.status === "COMPLETED") {
      const { BankReconciliationService } = await import("../services/bankReconciliationService.js");
      const { getJournalLineModel } = await import("./JournalLine.js");
      
      const JournalLine = await getJournalLineModel();
      // Find the bank ledger from the associated journal
      const lines = await JournalLine.find({ journalId: doc.journalId }).lean();
      
      for (const line of lines) {
        const isBank = await BankReconciliationService.isBankLedger(line.accountId, doc.companyId);
        if (isBank) {
          await BankReconciliationService.autoReconcile({
            id: doc._id,
            companyId: doc.companyId,
            amount: doc.amountPaid,
            date: doc.paymentDate,
            referenceNo: doc.reference,
            narration: doc.notes,
            bankLedgerId: line.accountId,
            type: "PAYMENT",
          });
          // Break after finding the first bank ledger in the payment journal
          break;
        }
      }
    }
  } catch (error) {
    console.error("Auto-reconciliation hook failed for Payment:", error.message);
  }
  next();
});

paymentSchema.index({ companyId: 1, invoiceId: 1 });
paymentSchema.index({ paymentDate: -1, status: 1 });
paymentSchema.index({ clientId: 1, paymentDate: -1 });

export const getPaymentModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Payment || db.model("Payment", paymentSchema);
};
