import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const StateSchema = new mongoose.Schema(
  {
    stateName: {
      type: String,
      required: true,
      trim: true,
    },
    stateCode: {
      type: String,
      required: true,
      trim: true,
    },
    gstStateCode: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: Schema.Types.ObjectId,
      ref: "Country",
      required: true,
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

// Ensure unique state code per country
StateSchema.index({ country: 1, stateCode: 1 }, { unique: true });

export const getStateModel = async () => {
  const db = getDatabase("master");
  return db.models.State || db.model("State", StateSchema);
};
