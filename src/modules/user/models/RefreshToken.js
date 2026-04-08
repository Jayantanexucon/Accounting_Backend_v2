import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, index: true },
  userId: { type: String, required: true }, // Store as string (User DB)
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  createdByIp: String,
  lastUsedAt: Date,
  replacedByToken: { type: String, default: null },
  revokedAt: { type: Date, default: null },
  revokedByIp: { type: String, default: null },
  reasonRevoked: { type: String, default: null },
});

refreshTokenSchema.virtual("isExpired").get(function () {
  return Date.now() >= this.expiresAt;
});

refreshTokenSchema.virtual("isActive").get(function () {
  return !this.revokedAt && !this.isExpired;
});

export const getRefreshTokenModel = async () => {
  const db = getDatabase("user");
  return db.models.RefreshToken || db.model("RefreshToken", refreshTokenSchema);
};