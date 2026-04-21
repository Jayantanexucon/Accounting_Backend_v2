import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

// ─── Currency Sub-schema ───────────────────────────────────────
const currencySchema = new Schema(
  {
    currencyName: { type: String, required: true, trim: true },
    currencyCode: { type: String, required: true, trim: true, uppercase: true },
    currencySymbol: { type: String, default: "", trim: true },
  },
  { _id: false }
);

// ─── Tax Configuration (ONLY FLAGS, NO RATES) ──────────────────
const taxConfigSchema = new Schema(
  {
    taxSystem: {
      type: String,
      enum: ["GST", "VAT", "SALES_TAX", "NONE"],
      default: "NONE",
    },
    isGSTApplicable: { type: Boolean, default: false },
    isRCMApplicable: { type: Boolean, default: false },
    isExportZeroRated: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Main Country Schema ───────────────────────────────────────
const CountrySchema = new mongoose.Schema(
  {
    // Basic Information
    countryName: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true },
    dialCode: { type: String, default: "", trim: true },

    // Currency Details (nested, inline)
    currency: {
      type: currencySchema,
      required: true,
    },

    // Tax Configuration (only flags - rates come from HSN/TaxRules)
    taxConfig: {
      type: taxConfigSchema,
      default: () => ({}),
    },

    // Address configuration
    postalCodeLabel: { type: String, trim: true, default: "Postal Code" },
    postalCodeRegex: { type: String, trim: true, default: "" },

    // Status
    isActive: { type: Boolean, default: true },

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Index for efficient queries
CountrySchema.index({ countryCode: 1 });
CountrySchema.index({ countryName: 1 });
CountrySchema.index({ "taxConfig.isGSTApplicable": 1 });

export const getCountryModel = async () => {
  const db = getDatabase("master");
  return db.models.Country || db.model("Country", CountrySchema);
};

// Helper function to get default country config
export const getDefaultCountryConfig = (countryCode) => {
  const defaults = {
    IN: {
      countryName: "India",
      countryCode: "IN",
      dialCode: "+91",
      currency: { currencyName: "Indian Rupee", currencyCode: "INR", currencySymbol: "₹" },
      taxConfig: {
        taxSystem: "GST",
        isGSTApplicable: true,
        isRCMApplicable: true,
        isExportZeroRated: true,
      },
    },
    US: {
      countryName: "United States",
      countryCode: "US",
      dialCode: "+1",
      currency: { currencyName: "US Dollar", currencyCode: "USD", currencySymbol: "$" },
      taxConfig: {
        taxSystem: "SALES_TAX",
        isGSTApplicable: false,
        isRCMApplicable: false,
        isExportZeroRated: false,
      },
    },
    GB: {
      countryName: "United Kingdom",
      countryCode: "GB",
      dialCode: "+44",
      currency: { currencyName: "British Pound", currencyCode: "GBP", currencySymbol: "£" },
      taxConfig: {
        taxSystem: "VAT",
        isGSTApplicable: false,
        isRCMApplicable: false,
        isExportZeroRated: false,
      },
    },
  };

  return defaults[countryCode] || null;
};
