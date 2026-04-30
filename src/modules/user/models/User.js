import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { connectUserDB } from "../../../config/db/user.db.js";

const permissionsSchema = new Schema(
  {
    entityId: { type: String, required: true }, // Reference to Entity from master DB
    actions: [{ type: String, enum: ["CREATE", "EDIT", "VIEW", "DELETE"] }],
    companyId: { type: String, required: true }, // Reference to Company from company DB
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["superAdmin", "admin", "user"],
      default: "user",
    },
    azureObjectId: { type: String, sparse: true }, // For Azure SSO
    tokenVersion: { type: Number, default: 0 },
    permissions: [permissionsSchema],
    isBlocked: { type: Boolean, default: false },
    blockedAt: Date,
    createdBy: { type: String }, // Super admin ID who created this user
    updatedBy: { type: String },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const getUserModel = async () => {
  const db = await connectUserDB();
  return db.models.User || db.model("User", userSchema);
};