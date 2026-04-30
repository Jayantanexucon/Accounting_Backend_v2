import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const accountTypeSchema = new mongoose.Schema(
  {
    group: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Income", "Expense"],
      required: [true, "Group is required"],
      unique: true,
    },
    types: [
      {
        type: String,
        trim: true,
      },
    ],
    description: String,
  },
  {
    timestamps: true,
  }
);

export const getAccountTypeModel = async () => {
  const db = getDatabase("accounting");
  return db.models.AccountType || db.model("AccountType", accountTypeSchema);
};
