import mongoose from "mongoose";
import { connectMasterDB } from "../../../config/db/master.db.js";

const VendorSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
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
    },
    pan: {
      type: String,
      trim: true,
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
    creditLimit: {
      type: Number,
      default: 0,
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
  const db = await connectMasterDB();
  return db.models.Vendor || db.model("Vendor", VendorSchema);
};
