import mongoose from "mongoose";
let accountingDB;

export const connectAccountingDB = async () => {
  if (!accountingDB) {
    accountingDB = await mongoose.createConnection(process.env.ACCOUNTING_DB_URI);
    console.log("Accounting DB connected");
  }
  return accountingDB;
};