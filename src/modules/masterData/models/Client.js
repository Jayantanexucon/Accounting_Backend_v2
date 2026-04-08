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

const versionSchema = new mongoose.Schema(
  {
    versionNo: { type: Number, default: 0 },
    snapshot: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["Approved", "Pending", "Rejected"] },
    statusDate: { type: Date },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const ClientSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    clientCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    ref: [versionSchema],
    clientType: {
      type: String,
      enum: ["Company", "Individual", "Government", "Export", "SEZ", "Other"],
      default: "Company",
    },
    address: addressSchema,
    gstin: { type: String, trim: true, default: "" },
    pan: { type: String, trim: true, default: "" },
    gstType: {
      type: String,
      enum: ["Regular", "Composition", "Unregistered", "Consumer", "SEZ", "Overseas"],
      default: "Regular",
    },
    taxIdentifier: { type: String, trim: true, default: "" },
    taxIdentifierType: {
      type: String,
      enum: ["PAN", "GST", "VAT", "EIN", "SSN", "CompanyNumber", "NationalID", "TIN", "ABN", "ACN", "UEN", "BN", "GST_HST", "CorporateNumber", "SIREN", "Steuernummer", "TRN"],
      default: "PAN",
    },
    contactPerson: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    paymentTerms: {
      type: String,
      enum: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
      default: "P1",
    },
    creditLimit: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const getClientModel = async () => {
  const db = getDatabase("master");
  return db.models.Client || db.model("Client", ClientSchema);
};
