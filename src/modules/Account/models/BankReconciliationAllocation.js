import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const bankReconciliationAllocationSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      index: true,
    },
    bankTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankTransaction",
      required: [true, "Bank transaction ID is required"],
      index: true,
    },
    // Can link to either Payment or Journal
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      default: null,
      index: true,
    },
    bankLedgerTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankLedgerTransaction",
      default: null,
      index: true,
    },
    allocatedAmount: {
      type: Number,
      required: [true, "Allocated amount is required"],
      min: 0,
    },
    matchType: {
      type: String,
      enum: ["AUTO", "MANUAL", "SYSTEM"],
      default: "MANUAL",
    },
    // Senior requested: matchScore
    matchScore: {
      type: Number,
      default: 0,
    },
    // Keeping for compatibility if needed, but primary is matchScore
    score: {
      type: Number,
      default: 0,
    },
    reasons: [String],
    note: {
      type: String,
      default: "",
    },
    matchedBy: {
      type: String,
      default: null,
    },
    matchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

bankReconciliationAllocationSchema.index(
  { companyId: 1, bankTransactionId: 1, paymentId: 1 },
  { sparse: true }
);

bankReconciliationAllocationSchema.index(
  { companyId: 1, bankTransactionId: 1, journalId: 1 },
  { sparse: true }
);

bankReconciliationAllocationSchema.index(
  { companyId: 1, bankTransactionId: 1, bankLedgerTransactionId: 1 },
  { sparse: true }
);

// Sync matchScore and score
bankReconciliationAllocationSchema.pre("save", function () {
  if (this.matchScore && !this.score) this.score = this.matchScore;
  if (this.score && !this.matchScore) this.matchScore = this.score;
});

export const getBankReconciliationAllocationModel = async () => {
  const db = getDatabase("accounting");
  return (
    db.models.BankReconciliationAllocation ||
    db.model("BankReconciliationAllocation", bankReconciliationAllocationSchema)
  );
};
