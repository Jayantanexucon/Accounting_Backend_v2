import jwt from "jsonwebtoken";
import AppError from "../../utils/AppError.js";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret";

export const createAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

export const createRefreshTokenString = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      tokenVersion: user.tokenVersion,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    throw new AppError("Invalid access token", 401, "verifyAccessToken");
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new AppError("Invalid refresh token", 401, "verifyRefreshToken");
  }
};

const COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || "jid";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const sendRefreshTokenCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
  });
};
