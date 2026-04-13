import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const poLineItemSchema = new mongoose.Schema({
  itemId: { type: String },
  description: { type: String, required: true },
  hsnSac: { type: String },
  quantity: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  taxableValue: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 0, min: 0 },
  gstAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  invoicedQuantity: { type: Number, default: 0, min: 0 },
  invoicedAmount: { type: Number, default: 0, min: 0 },
});

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  stateCode: { type: String },
  gstin: { type: String },
});

// Milestone schema for project-based POs
const poMilestoneSchema = new mongoose.Schema({
  milestoneNo: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
  targetDate: { type: Date },
  deliveryDate: { type: Date },
  amount: { type: Number, required: true, min: 0 },
  invoicedAmount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed", "Verified"],
    default: "Pending",
  },
  remarks: { type: String },
});

// Resource schema for staffing POs
const resourceSchema = new mongoose.Schema({
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource" },
  resourceName: { type: String, required: true },
  designation: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  dailyRate: { type: Number, required: true, min: 0 },
  billableHoursPerDay: { type: Number, default: 8, min: 0 },
  status: {
    type: String,
    enum: ["Active", "On Leave", "Inactive"],
    default: "Active",
  },
});

// Attendance record schema for resource tracking
const attendanceRecordSchema = new mongoose.Schema({
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource" },
  date: { type: Date, required: true },
  hoursWorked: { type: Number, required: true, min: 0 },
  description: { type: String },
  approved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvalDate: { type: Date },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    poNumber: { type: String, unique: true, required: true },
    poDate: { type: Date, required: true },
    deliveryDate: { type: Date, required: true },
    referenceDate: { type: Date },
    currency: { type: String, default: "INR" },

    // PO Category
    poCategory: {
      type: String,
      enum: ["general", "project", "staffing", "retainer"],
      default: "general",
    },

    // Billing Model
    billingModel: {
      type: String,
      enum: ["fixed", "milestone", "daily", "monthly", "hourly"],
      default: "fixed",
    },

    // Payment Terms
    paymentTerms: {
      type: String,
      enum: ["advance", "immediate", "net-15", "net-30", "net-45", "net-60", "net-90", "cod"],
      default: "net-30",
    },

    // Vendor/Client Info
    vendor: { type: addressSchema, required: true },
    deliverTo: { type: addressSchema, required: true },

    // Line Items
    items: { type: [poLineItemSchema], required: true },

    // Milestones (for project-based POs)
    milestones: [poMilestoneSchema],

    // Resources (for staffing POs)
    resources: [resourceSchema],

    // Attendance Records (for resource tracking)
    attendanceRecords: [attendanceRecordSchema],

    // Financial Totals
    totalTaxableValue: { type: Number, required: true, min: 0 },
    totalGSTAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    valueInWords: { type: String },

    // Tracking
    totalInvoicedAmount: { type: Number, default: 0, min: 0 },
    totalPaidAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["OPEN", "PARTIALLY_INVOICED", "FULLY_INVOICED", "CLOSED"],
      default: "OPEN",
    },
    invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],

    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index
purchaseOrderSchema.index({ companyId: 1, poNumber: 1 });
purchaseOrderSchema.index({ companyId: 1, status: 1 });
purchaseOrderSchema.index({ companyId: 1, poDate: -1 });

export const getPurchaseOrderModel = async () => {
  const db = getDatabase("invoice");
  return db.models.PurchaseOrder || db.model("PurchaseOrder", purchaseOrderSchema);
};
