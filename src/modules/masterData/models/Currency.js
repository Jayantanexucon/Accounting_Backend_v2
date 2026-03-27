import mongoose, { Schema } from "mongoose";
import { connectMasterDB } from "../../../config/db/master.db.js";

const CurrencySchema = new mongoose.Schema(
  {
    currencyName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    currencyCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    currencySymbol: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const getCurrencyModel = async () => {
  const db = await connectMasterDB();
  return db.models.Currency || db.model("Currency", CurrencySchema);
};
