import mongoose from "mongoose";
import { connectMasterDB } from "../../../config/db/master.db.js";

const HSNSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      required: true,
      trim: true,
    },
    hsnCode: {
      type: String,
      required: true,
      trim: true,
    },
    tdsApplicable: {
      type: Boolean,
      default: false,
    },
    tdsRate: {
      type: Number,
      default: 0,
    },
    tdsSection: {
      type: String,
      default: "",
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    igst: {
      type: Number,
      required: true,
    },
    cgst: {
      type: Number,
      required: true,
    },
    sgst: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Enforce unique HSN per company
HSNSchema.index({ companyId: 1, hsnCode: 1, serviceType: 1 }, { unique: true });

export const getHSNModel = async () => {
  const db = await connectMasterDB();
  return db.models.HSN || db.model("HSN", HSNSchema);
};
