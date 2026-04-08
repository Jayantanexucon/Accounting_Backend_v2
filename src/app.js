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

// Conditionally register module-specific routes
const connectedModules = getConnectedModules();

if (connectedModules.includes("accounting")) {
  console.log("✅ Accounting module routes registered at /api/accounting");
  app.use("/api/accounting", accountingRoutes);
}

if (connectedModules.includes("invoice")) {
  console.log("✅ Invoice module routes registered at /api/invoice");
  app.use("/api/invoice", invoiceRoutes);
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
