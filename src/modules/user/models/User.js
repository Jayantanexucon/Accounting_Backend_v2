import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { connectUserDB } from "../../../config/db/user.db.js";

const permissionsSchema = new Schema({
  entity: { type: String },
  actions: [{ type: String, enum: ["CREATE", "EDIT", "VIEW", "DELETE"] }],
  company: { type: Schema.Types.ObjectId, ref: "Company" },
});

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
    azureObjectId: { type: String },
    tokenVersion: { type: Number, default: 0 },
    permissions: [permissionsSchema],
    isBlocked: { type: Boolean, default: false },
    blockedAt: Date,
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

// password hash
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const getUserModel = async () => {
  const db = await connectUserDB();
  return db.models.User || db.model("User", userSchema);
};