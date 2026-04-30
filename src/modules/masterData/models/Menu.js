import mongoose, { Schema } from "mongoose";
import { connectMasterDB } from "../../../config/db/master.db.js";

const MenuSchema = new mongoose.Schema(
  {
    menuKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    menuName: {
      type: String,
      required: true,
      trim: true,
    },
    menuValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "general",
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

export const getMenuModel = async () => {
  const db = await connectMasterDB();
  return db.models.Menu || db.model("Menu", MenuSchema);
};
