import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { initializeDatabaseConnections, getConnectedModules } from "./config/databases.js";
import errorHandler from "./utils/errorHandler.js";
import { initializeEntities } from "./utils/initializeEntities.js";

// Routes
import authRoutes from "./modules/auth/routes.js";
import userRoutes from "./modules/user/routers/routes.js";
import companyRoutes from "./modules/company/routers/routes.js";
import masterDataRoutes from "./modules/masterData/routers/masterDataRoutes.js";
import accountingRoutes from "./modules/Account/routers/accountingAggregator.js";
import invoiceRoutes from "./modules/Invoice/routers/invoiceAggregator.js";
import invoiceAccountingRoutes from "./modules/Invoice/routers/invoiceAccountingRoutes.js";
import auditRoutes from "./modules/audit/routes.js";
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
    // ✅ Validate AVAILABLE_MODULES before initializing
    const modulesEnv = process.env.AVAILABLE_MODULES;
    if (!modulesEnv) {
      throw new Error("❌ AVAILABLE_MODULES is not defined in environment variables!");
    }

    // ✅ Validate JSON format
    try {
      JSON.parse(modulesEnv);
    } catch (parseError) {
      throw new Error(`❌ Invalid JSON in AVAILABLE_MODULES: ${parseError.message}\nValue: ${modulesEnv}`);
    }

    // Initialize all databases from AVAILABLE_MODULES
    await initializeDatabaseConnections();

    // Initialize default entities after all databases are connected
    await initializeEntities();
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
app.use("/api/audit-logs", auditRoutes);

/**
 * Register module-specific routes based on connected databases
 * This is called AFTER databases are initialized
 */
export const registerModuleRoutes = () => {
  try {
    // ✅ Now this is safe - databases are already initialized when this is called
    const connectedModules = getConnectedModules();
    console.log('====================================');
    console.log('Connected Modules:', connectedModules);
    console.log('====================================');

    if (connectedModules.includes("accounting")) {
      console.log("✅ Accounting module routes registered at /api/accounting");
      app.use("/api/accounting", accountingRoutes);
    }

    if (connectedModules.includes("invoice")) {
      console.log("✅ Invoice module routes registered at /api/invoice");
      app.use("/api/invoices", invoiceRoutes);
      console.log("✅ Invoice accounting routes registered at /api/invoice-accounting");
      app.use("/api/invoice-accounting", invoiceAccountingRoutes);
    }
  } catch (error) {
    console.error("⚠️  Failed to register module routes:", error.message);
  }
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
 
