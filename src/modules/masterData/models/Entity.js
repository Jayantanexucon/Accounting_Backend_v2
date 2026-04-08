import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const EntitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isNavItem: {
      type: Boolean,
      default: false,
    },
    system: {
      type: Boolean,
      default: false,
    },
    navLink: {
      type: String,
      default: "",
      trim: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Entity",
      default: null,
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

export const getEntityModel = async () => {
  const db = getDatabase("master");
  return db.models.Entity || db.model("Entity", EntitySchema);
};