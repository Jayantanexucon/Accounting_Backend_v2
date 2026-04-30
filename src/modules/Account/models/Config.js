import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const configSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Config key is required"],
      trim: true,
    },
    value: mongoose.Schema.Types.Mixed,
    description: String,
    companyId: {
      type: String,
      indexed: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on key + companyId for multi-tenant support
configSchema.index({ key: 1, companyId: 1 }, { unique: true, sparse: true });

export const getConfigModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Config || db.model("Config", configSchema);
};
