import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { connectUserDB } from "./config/db/user.db.js";
import { connectInvoiceDB } from "./config/db/invoice.db.js";
import { connectCompanyDB } from "./config/db/company.db.js";
import { connectAccountingDB } from "./config/db/accounting.db.js";
import { connectAuditDB } from "./config/db/audit.db.js";
import { connectMasterDB } from "./config/db/master.db.js";
import errorHandler from "./utils/errorHandler.js";

// Routes
import authRoutes from "./modules/auth/routes.js";
import userRoutes from "./modules/user/routers/routes.js";
import companyRoutes from "./modules/company/routers/routes.js";
import masterDataRoutes from "./modules/masterData/routers/masterDataRoutes.js";
import accountingRoutes from "./modules/Account/routers/accountingAggregator.js";
import invoiceRoutes from "./modules/Invoice/routers/invoiceAggregator.js";
import systemRoutes from "./routes/systemRoutes.js";
import dotenv from "dotenv";
dotenv.config();


const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(passport.initialize());

// Initialize all database connections
export const initializeDatabases = async () => {
  try {
    // Parse available modules from environment variable
    const availableModules = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    console.log(`📦 Initializing modules: ${availableModules.length > 0 ? availableModules.join(", ") : "core only"}`);

    // Always connect core databases
    await connectUserDB();
    await connectCompanyDB();
    await connectAuditDB();
    await connectMasterDB();

    // Conditionally connect module-specific databases
    if (availableModules.includes("invoice")) {
      await connectInvoiceDB();
    } else {
      console.log("⏭️  Invoice module disabled - skipping invoice_db connection");
    }

    if (availableModules.includes("accounting")) {
      await connectAccountingDB();
    } else {
      console.log("⏭️  Accounting module disabled - skipping accounting_db connection");
    }

    console.log("✅ All available databases connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "✅ Server and databases are connected" });
});

// System Info Routes (PUBLIC - No authentication required)
app.use("/api/system", systemRoutes);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/masterData", masterDataRoutes);

// Conditionally register module-specific routes
const availableModules = (process.env.AVAILABLE_MODULE || "")
  .split(",")
  .map((m) => m.trim().toLowerCase())
  .filter((m) => m.length > 0);

console.log("hiiiiiiiiiiiii");
console.log(process.env.AVAILABLE_MODULE);


console.log(availableModules);


if (availableModules.includes("accounting")) {
  console.log('====================================');
  console.log("accounting module availavle");
  console.log('====================================');
  app.use("/api/accounting", accountingRoutes);
  console.log("✅ Accounting module routes registered at /api/accounting");
}

if (availableModules.includes("invoice")) {
  app.use("/api/invoice", invoiceRoutes);
  console.log("✅ Invoice module routes registered at /api/invoice");
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error Handler (must be last)
app.use(errorHandler);

export default app;
