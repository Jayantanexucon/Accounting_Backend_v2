import mongoose from "mongoose";
let auditDB;

export const connectAuditDB = async () => {
  if (!auditDB) {
    auditDB = await mongoose.createConnection(process.env.AUDIT_DB_URI);
    console.log("Audit DB connected");
  }
  return auditDB;
};