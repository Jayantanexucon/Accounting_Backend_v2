import mongoose, { Schema } from "mongoose";
import { connectCompanyDB } from "../../../config/db/company.db.js";

const addressSchema = new Schema(
  {
    line1: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: "India" },
    pincode: { type: String },
  },
  { _id: false }
);

const taxSchema = new Schema(
  {
    gstType: {
      type: String,
      enum: ["Regular", "Unregistered"],
      default: "Unregistered",
    },
    gstin: { type: String },
    pan: { type: String },
  },
  { _id: false }
);

const bankSchema = new Schema(
  {
    bankName: { type: String },
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifsc: { type: String },
  },
  { _id: false }
);

const invoiceConfigSchema = new Schema(
  {
    prefix: { type: String, default: "INV/" },
    startingNumber: { type: Number, default: 1 },
    paymentTerms: { type: String },
    termsAndConditions: { type: String },
    logoUrl: { type: String },
  },
  { _id: false }
);

const accountingConfigSchema = new Schema(
  {
    baseCurrency: { type: String, default: "INR" },
    decimalPlaces: { type: Number, default: 2 },
    enableBillWise: { type: Boolean, default: true },
    enableBankReconciliation: { type: Boolean, default: true },
    enableAuditTrail: { type: Boolean, default: true },
  },
  { _id: false }
);

const privilegeSchema = new Schema(
  {
    masterUpdate: { type: Boolean, default: false },
  },
  { _id: false }
);

const employeesSchema = new Schema(
  {
    userId: { type: String, required: true }, // Store user ID as string
    role: { type: String },
    privilege: {
      type: privilegeSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

const companySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    owner: {
      type: String, // Store as string (User DB ID)
      required: true,
    },
    registeredAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    taxDetails: {
      type: taxSchema,
      default: () => ({}),
    },
    bankDetails: {
      type: bankSchema,
      default: () => ({}),
    },
    invoiceConfig: {
      type: invoiceConfigSchema,
      default: () => ({}),
    },
    accountingConfig: {
      type: accountingConfigSchema,
      default: () => ({}),
    },
    employees: [employeesSchema],
    isActive: { type: Boolean, default: true },
    lastModifiedBy: { type: String },
  },
  { timestamps: true }
);

export const getCompanyModel = async () => {
  const db = await connectCompanyDB();
  return db.models.Company || db.model("Company", companySchema);
};