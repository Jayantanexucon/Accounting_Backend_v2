import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const addressSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DEFAULT", "SHIP_TO", "BILL_TO", "BRANCH", "OTHER"],
      default: "DEFAULT",
    },
    label: { type: String, trim: true, default: "" },
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    pinCode: { type: String, trim: true, default: "" },
    stateCode: { type: String, trim: true, default: "" },
    gstStateCode: { type: String, trim: true, default: "" },
    taxType: { type: String, trim: true, default: "" },
    taxNumber: { type: String, trim: true, uppercase: true, default: "" },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: "Country", default: null },
    stateId: { type: mongoose.Schema.Types.ObjectId, ref: "State", default: null },
    isDefault: { type: Boolean, default: false },
    isShipTo: { type: Boolean, default: false },
  },
  { _id: true }
);

const taxDetailSchema = new mongoose.Schema(
  {
    taxType: { type: String, trim: true, default: "" },
    taxNumber: { type: String, trim: true, uppercase: true, default: "" },
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const VendorSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      // ref: "Company",
      required: true,
      index: true,
    },
    vendorCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    registeredAddress: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    pinCode: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
      default: "",
    },
    pan: {
      type: String,
      trim: true,
      default: "",
    },
    vatNumber: {
      type: String,
      trim: true,
      default: "",
    },
    einNumber: {
      type: String,
      trim: true,
      default: "",
    },
    ssnNumber: {
      type: String,
      trim: true,
      default: "",
    },
    companyNumber: {
      type: String,
      trim: true,
      default: "",
    },
    nationalIdNumber: {
      type: String,
      trim: true,
      default: "",
    },
    taxIdentifierType: {
      type: String,
      trim: true,
      default: "",
    },
    taxIdentificationNumber: {
      type: String,
      trim: true,
      default: "",
    },
    taxDetails: {
      type: [taxDetailSchema],
      default: [],
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    defaultAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    additionalAddresses: {
      type: [addressSchema],
      default: [],
    },
    billingAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    shippingAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    gstType: {
      type: String,
      trim: true,
      default: "",
    },
    serviceType: {
      type: String,
      trim: true,
    },
    goodsType: {
      type: String,
      trim: true,
    },
    paymentTerms: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    currencySymbol: {
      type: String,
      trim: true,
      default: "₹",
    },
    currencyName: {
      type: String,
      trim: true,
      default: "Indian Rupee",
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    tdsApplicable: {
      type: Boolean,
      default: false,
    },
    tdsRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tdsSection: {
      type: String,
      trim: true,
      default: "",
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    agreementStartDate: {
      type: Date,
    },
    agreementEndDate: {
      type: Date,
    },
    complianceDocs: {
      type: [String],
      default: [],
    },
    parentVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    isSubVendor: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
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

export const getVendorModel = async () => {
  const db = getDatabase("master");
  return db.models.Vendor || db.model("Vendor", VendorSchema);
};
