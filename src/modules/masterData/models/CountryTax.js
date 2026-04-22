import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const UserActionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);

const SnapshotSchema = new mongoose.Schema(
  {
    taxType: { type: String },
    taxRate: { type: Number },
    taxLabel: { type: String },
    description: { type: String },
    isActive: { type: Boolean },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: UserActionSchema, required: true },
  },
  { _id: false }
);

const CountryTaxSchema = new mongoose.Schema(
  {
    countryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
      index: true,
    },
    // Keep standard fields for easy lookup without population
    countryName: {
      type: String,
      required: true,
      trim: true,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    taxType: {
      // Dynamic strings e.g. "SALES_TAX", "VAT", "GST", "NONE", or anything user enters
      type: String,
      required: true,
      trim: true,
      default: "GST",
    },
    taxRate: {
      // Percentage e.g. 18
      type: Number,
      required: true,
      default: 0,
    },
    taxLabel: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    snapshots: [SnapshotSchema],
    createdBy: {
      type: UserActionSchema,
      required: true,
    },
    updatedBy: {
      type: UserActionSchema,
      required: true,
    },
  },
  { timestamps: true }
);

// Unique country code index
CountryTaxSchema.index({ countryCode: 1 }, { unique: true });
CountryTaxSchema.index({ countryId: 1 }, { unique: true });

export const getCountryTaxModel = async () => {
  const db = getDatabase("master");
  return db.models.CountryTax || db.model("CountryTax", CountryTaxSchema);
};
