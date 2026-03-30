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
import userRoutes from "./modules/user/routes.js";
import companyRoutes from "./modules/company/routers/routes.js";
import masterDataRoutes from "./modules/masterData/routers/masterDataRoutes.js";
import accountingRoutes from "./modules/Account/routers/accountingAggregator.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(passport.initialize());

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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "✅ Server and databases are connected" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/masterData", masterDataRoutes);
app.use("/api/accounting", accountingRoutes);

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