import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const schema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true },
  description: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
}, { timestamps: true });
schema.index({ companyId: 1, normalizedName: 1 }, { unique: true });

export const getExpenseAuditCategoryModel = async () => {
  const db = getDatabase("accounting");
  return db.models.ExpenseAuditCategory || db.model("ExpenseAuditCategory", schema);
};
