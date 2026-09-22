import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const schema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  transactionDate: { type: Date, required: true, index: true },
  description: { type: String, default: "" },
  debitAmount: { type: Number, default: 0 },
  creditAmount: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  direction: { type: String, enum: ["DEBIT", "CREDIT", ""], default: "" },
  identifierId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseAuditIdentifier", default: null, index: true },
  identifierName: { type: String, default: "", index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseAuditCategory", default: null, index: true },
  categoryName: { type: String, default: "", index: true },
  categorySource: { type: String, enum: ["AUTO", "MANUAL", ""], default: "" },
  categorizedAt: { type: Date, default: null },
  categorizedBy: { type: String, default: null },
  rowNumber: { type: Number, default: null },
  fileName: { type: String, default: "" },
  importBatchId: { type: String, required: true, index: true },
  originalRowData: { type: Object, default: null },
  duplicateKey: { type: String, default: "", index: true },
}, { timestamps: true });
schema.index({ companyId: 1, transactionDate: 1, identifierId: 1 });

export const getExpenseAuditTransactionModel = async () => {
  const db = getDatabase("accounting");
  return db.models.ExpenseAuditTransaction || db.model("ExpenseAuditTransaction", schema);
};
