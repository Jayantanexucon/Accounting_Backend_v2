import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const schema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  financialYearEnding: { type: Number, required: true, index: true },
  versionNumber: { type: Number, required: true, index: true },
  label: { type: String, required: true, trim: true },
  fileName: { type: String, default: "" },
  baseVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseAuditVersion", default: null, index: true },
  active: { type: Boolean, default: false, index: true },
  snapshot: { type: [Object], default: [] },
  summary: {
    importedCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    identifiedCount: { type: Number, default: 0 },
    totalRows: { type: Number, default: 0 },
  },
  createdBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ companyId: 1, financialYearEnding: 1, versionNumber: 1 }, { unique: true });

export const getExpenseAuditVersionModel = async () => {
  const db = getDatabase("accounting");
  return db.models.ExpenseAuditVersion || db.model("ExpenseAuditVersion", schema);
};
