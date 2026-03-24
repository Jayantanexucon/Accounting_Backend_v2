import mongoose from "mongoose";
let invoiceDB;

export const connectInvoiceDB = async () => {
  if (!invoiceDB) {
    invoiceDB = await mongoose.createConnection(process.env.INVOICE_DB_URI);
    console.log("Invoice DB connected");
  }
  return invoiceDB;
};