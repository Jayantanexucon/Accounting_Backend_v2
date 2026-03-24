import express from "express";
import cors from "cors";
import { connectUserDB } from "./config/db/user.db.js";
import { connectInvoiceDB } from "./config/db/invoice.db.js";
import { connectCompanyDB } from "./config/db/company.db.js";
import { connectAccountingDB } from "./config/db/accounting.db.js";
import { connectAuditDB } from "./config/db/audit.db.js";
import { connectMasterDB } from "./config/db/master.db.js";

const app = express();

app.use(cors());
app.use(express.json());

// Initialize all database connections
export const initializeDatabases = async () => {
  try {
    await connectUserDB();
    await connectInvoiceDB();
    await connectCompanyDB();
    await connectAccountingDB();
    await connectAuditDB();
    await connectMasterDB();
    console.log("✅ All databases connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};
app.get("/health", (req, res) => {
  res.json({ status: "✅ Server and databases are connected" });
});

export default app;