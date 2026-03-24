import mongoose, { Schema } from "mongoose";
import { connectMasterDB } from "../../../config/db/master.db.js";

const EntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    key: { type: String, required: true, trim: true, unique: true },
    isNavItem: { type: Boolean, default: false },
    system: { type: Boolean, default: false },
    navLink: String,
    parent: { type: Schema.Types.ObjectId, ref: "Entity" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ✅ IMPORTANT CHANGE
export const getEntityModel = async () => {
  const db = await connectMasterDB();
  return db.models.Entity || db.model("Entity", EntitySchema);
};