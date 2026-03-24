import mongoose from "mongoose";
let companyDB;

export const connectCompanyDB = async () => {
  if (!companyDB) {
    companyDB = await mongoose.createConnection(process.env.COMPANY_DB_URI);
    console.log("Company DB connected");
  }
  return companyDB;
};