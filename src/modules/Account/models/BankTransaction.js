import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const bankTransactionSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      index: true,
    },
    // Senior requested: date
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      index: true,
    },
    // Keeping for frontend compatibility
    transactionDate: {
      type: Date,
      index: true,
    },
    valueDate: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
    },
    type: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: [true, "Type is required"],
      default: "CREDIT",
    },
    // Senior requested: referenceNo
    referenceNo: {
      type: String,
      default: "",
    },
    // Keeping for frontend compatibility
    reference: {
      type: String,
      default: "",
    },
    normalizedReference: {
      type: String,
      default: "",
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      index: true,
    },
    balance: {
      type: Number,
      default: null,
    },
    fileName: {
      type: String,
      default: "",
    },
    importBatchId: {
      type: String,
      default: "",
      index: true,
    },
    sourceRow: {
      type: Object,
      default: null,
    },
    isReconciled: {
      type: Boolean,
      default: false,
      index: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ["UNMATCHED", "PARTIAL", "MATCHED"],
      default: "UNMATCHED",
      index: true,
    },
    matchSuggestions: [
      {
        paymentId: String,
        score: Number,
        matchType: {
          type: String,
          enum: ["EXACT", "POTENTIAL", "PARTIAL"],
          default: "POTENTIAL",
        },
        reasons: [String],
      },
    ],
    createdBy: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to sync date/transactionDate and reference/referenceNo
bankTransactionSchema.pre("save", function () {
  if (this.date && !this.transactionDate) this.transactionDate = this.date;
  if (this.transactionDate && !this.date) this.date = this.transactionDate;
  if (this.referenceNo && !this.reference) this.reference = this.referenceNo;
  if (this.reference && !this.referenceNo) this.referenceNo = this.reference;
});

bankTransactionSchema.index({ companyId: 1, reconciliationStatus: 1, date: -1 });
bankTransactionSchema.index({ bankLedgerId: 1, date: -1 });

export const getBankTransactionModel = async () => {
  const db = getDatabase("accounting");
  return db.models.BankTransaction || db.model("BankTransaction", bankTransactionSchema);
};
