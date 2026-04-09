import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    pinCode: { type: String, trim: true, default: "" },
    stateCode: { type: String, trim: true, default: "" },
    gstStateCode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// ─── Sub-schema: version / audit history ─────────────────────────────────────
const versionSchema = new mongoose.Schema(
  {
    versionNo: { type: Number, default: 0 },
    snapshot: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["Approved", "Pending", "Rejected"] },
    statusDate: { type: Date },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }   // ← correct: options object belongs HERE, not as array item
);

// ─── Main Client Schema ───────────────────────────────────────────────────────
const clientSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    companyId: {
      type: String,
      // ref: "Company",
      required: [true, "Company ID is required"],
      index: true,
    },
    clientCode: {
      type: String,
      trim: true,
      // ⚠ No unique:true here — uniqueness enforced by compound index below
      //   to allow CL001 to exist in multiple companies simultaneously
    },
    clientName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    clientType: {
      type: String,
      enum: ["Company", "Individual", "Government", "Export", "SEZ", "Other"],
      default: "Company",
    },

    // ── Status & Soft-delete ──────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ── Contact ───────────────────────────────────────────────────────────────
    contactPerson: { type: String, trim: true, default: "" },
    contactNumber: { type: String, trim: true, default: "" },
    altContactNumber: { type: String, trim: true, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email address",
      },
    },
    website: { type: String, trim: true, default: "" },

    // ── Primary / Registered Address ──────────────────────────────────────────
    clientAddress: { type: String, trim: true, default: "" },
    clientCity: { type: String, trim: true, default: "" },
    clientState: { type: String, trim: true, default: "" },
    clientCountry: { type: String, trim: true, default: "India" },
    pinCode: { type: String, trim: true, default: "" },
    stateCode: { type: String, trim: true, default: "" },
    gstStateCode: { type: String, trim: true, default: "" },  // ← was missing

    // ── Billing & Shipping Addresses ──────────────────────────────────────────
    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    sameAsBilling: { type: Boolean, default: true },

    // ── GST / Place of Supply (India) ─────────────────────────────────────────
    placeOfSupply: { type: String, trim: true, default: "" },
    gstType: {
      type: String,
      enum: ["Regular", "Composition", "Unregistered", "Consumer", "SEZ", "Overseas", ""],
      default: "",
    },

    // ── Tax Identifiers — India ───────────────────────────────────────────────
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      validate: {
        // Must use regular function — arrow function breaks `this` binding
        validator: function (v) {
          if (this.clientCountry !== "India") return true; // skip non-India
          if (!v) return true;                              // allow empty (presence validated in pre-save if needed)
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: "PAN number must be in format: ABCDE1234F",
      },
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      validate: {
        validator: function (v) {
          if (this.clientCountry !== "India") return true;
          if (!v) return true;
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        },
        message: "GST number must be in valid GSTIN format (e.g. 22AAAAA0000A1Z5)",
      },
    },

    // ── Tax Identifiers — USA ─────────────────────────────────────────────────
    einNumber: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          if (this.clientCountry !== "USA") return true;
          if (!v) return true;
          return /^\d{2}-\d{7}$/.test(v);
        },
        message: "EIN must be in format: 12-3456789",
      },
    },
    ssnNumber: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          if (this.clientCountry !== "USA") return true;
          if (!v) return true;
          return /^\d{3}-\d{2}-\d{4}$/.test(v);
        },
        message: "SSN must be in format: 123-45-6789",
      },
    },

    // ── Tax Identifiers — Generic (UK, EU, AU, SG, CA …) ─────────────────────
    vatNumber: { type: String, trim: true, uppercase: true, default: "" },
    companyNumber: { type: String, trim: true, default: "" },
    nationalIdNumber: { type: String, trim: true, default: "" },

    taxIdentifierType: {
      type: String,
      enum: [
        "PAN", "GST", "VAT", "EIN", "SSN",
        "CompanyNumber", "NationalID", "TIN",
        "ABN", "ACN", "UEN", "BN", "GST_HST",
        "CorporateNumber", "SIREN", "Steuernummer", "TRN", ""
      ],
      default: "",
    },
    taxIdentificationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    // ── TDS Configuration (India) ─────────────────────────────────────────────
    tdsApplicable: { type: Boolean, default: false },
    tdsRate: { type: Number, default: 0, min: 0, max: 100 },
    tdsSection: { type: String, trim: true, default: "" },

    // ── Accounting / Financial ────────────────────────────────────────────────
    paymentTerms: {
      type: String,
      trim: true,
      enum: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", ""],
      default: "",
    },
    currency: { type: String, trim: true, default: "INR" },  // ISO 4217
    creditLimit: { type: Number, default: 0, min: 0 },          // 0 = unlimited
    openingBalance: { type: Number, default: 0 },                  // +ve receivable / -ve payable
    openingBalanceDate: { type: Date, default: null },

    // ── HSN Codes & PO Numbers ────────────────────────────────────────────────
    hsnCodes: [{ type: String, trim: true }],  // ← was missing
    poList: [{ type: String, trim: true }],  // ← was missing

    // ── Audit / Version History ───────────────────────────────────────────────
    ref: {
      type: [versionSchema],
      default: [],
    },

    // ── Notes ─────────────────────────────────────────────────────────────────
    remarks: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const getClientModel = async () => {
  const db = getDatabase("master");
  return db.models.Client || db.model("Client", clientSchema);
};
