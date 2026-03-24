import mongoose from "mongoose";
let masterDB;

export const connectMasterDB = async () => {
  if (!masterDB) {
    masterDB = await mongoose.createConnection(process.env.MASTER_DB_URI);
    console.log("Master DB connected");
  }
  return masterDB;
};