import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const CountrySchema = new mongoose.Schema(
  {
    countryName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    dialCode: {
      type: String,
      default: "",
      trim: true,
    },
    currency: {
      type: Schema.Types.ObjectId,
      ref: "Currency",
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

export const getCountryModel = async () => {
  const db = getDatabase("master");
  return db.models.Country || db.model("Country", CountrySchema);
};
