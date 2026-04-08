import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const CitySchema = new mongoose.Schema(
  {
    cityName: {
      type: String,
      required: true,
      trim: true,
    },
    cityCode: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    country: {
      type: Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
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

// Ensure unique city per state
CitySchema.index({ state: 1, cityName: 1 }, { unique: true });

export const getCityModel = async () => {
  const db = getDatabase("master");
  return db.models.City || db.model("City", CitySchema);
};
