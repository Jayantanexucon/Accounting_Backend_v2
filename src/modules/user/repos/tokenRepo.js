import { getRefreshTokenModel } from "../models/RefreshToken.js";
import crypto from "crypto";
import AppError from "../../../utils/AppError.js";

export const saveRefreshToken = async (tokenData) => {
  try {
    const RefreshToken = await getRefreshTokenModel();
    const tokenHash = crypto.createHash("sha256").update(tokenData.token).digest("hex");
    
    return await RefreshToken.create({
      tokenHash,
      userId: tokenData.userId.toString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdByIp: tokenData.createdByIp,
    });
  } catch (error) {
    throw new AppError(error.message, 500, "saveRefreshToken");
  }
};

export const findRefreshTokenDoc = async (token) => {
  try {
    const RefreshToken = await getRefreshTokenModel();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    return await RefreshToken.findOne({ tokenHash });
  } catch (error) {
    throw new AppError(error.message, 500, "findRefreshTokenDoc");
  }
};

export const revokeRefreshToken = async (tokenDoc, ipAddress, reason = "manual") => {
  try {
    tokenDoc.revokedAt = new Date();
    tokenDoc.revokedByIp = ipAddress;
    tokenDoc.reasonRevoked = reason;
    return await tokenDoc.save();
  } catch (error) {
    throw new AppError(error.message, 500, "revokeRefreshToken");
  }
};

export const rotateRefreshToken = async (oldTokenDoc, newTokenString, ipAddress) => {
  try {
    const RefreshToken = await getRefreshTokenModel();
    const newTokenHash = crypto.createHash("sha256").update(newTokenString).digest("hex");
    
    // Revoke old token
    oldTokenDoc.replacedByToken = newTokenHash;
    oldTokenDoc.revokedAt = new Date();
    oldTokenDoc.revokedByIp = ipAddress;
    oldTokenDoc.reasonRevoked = "rotated";
    await oldTokenDoc.save();
    
    // Create new token
    return await RefreshToken.create({
      tokenHash: newTokenHash,
      userId: oldTokenDoc.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdByIp: ipAddress,
    });
  } catch (error) {
    throw new AppError(error.message, 500, "rotateRefreshToken");
  }
};