import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const bankLedgerTransactionSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      index: true,
    },
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
    },
    transactionType: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: [true, "Transaction type is required"],
    },
    referenceNo: {
      type: String,
      default: "",
    },
    narration: {
      type: String,
      default: "",
    },
    bankReference: { type: String, default: "" },
    paymentReference: { type: String, default: "" },
    instrumentNo: { type: String, default: "" },
    transactionMode: { type: String, default: "" },
    counterpartyName: { type: String, default: "" },
    reconciliationKeywords: { type: [String], default: [] },
    searchableText: { type: String, default: "", index: true },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Bank ledger ID is required"],
      index: true,
    },
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: [true, "Journal ID is required"],
      index: true,
    },
    journalLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalLine",
      required: [true, "Journal line ID is required"],
      index: true,
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
    allocatedAmount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bankLedgerTransactionSchema.index({ companyId: 1, bankLedgerId: 1, date: -1 });
bankLedgerTransactionSchema.index({ journalId: 1, journalLineId: 1 });

export const getBankLedgerTransactionModel = async () => {
  const db = getDatabase("accounting");
  return db.models.BankLedgerTransaction || db.model("BankLedgerTransaction", bankLedgerTransactionSchema);
};
