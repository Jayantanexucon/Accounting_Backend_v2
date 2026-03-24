import mongoose from "mongoose";
import { connectUserDB } from "../../../config/db/user.db.js";

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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

// ✅ IMPORTANT CHANGE
export const getRefreshTokenModel = async () => {
  const db = await connectUserDB();
  return db.models.RefreshToken || db.model("RefreshToken", refreshTokenSchema);
};