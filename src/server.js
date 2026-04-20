import dotenv from "dotenv";
dotenv.config();

import app, { initializeDatabases, registerModuleRoutes } from "./app.js";
import { configurePassport } from "./config/passport.js";

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    // Configure Passport strategies
    configurePassport();
    
    // Initialize databases first
    await initializeDatabases();
    
    // ✅ Register module routes AFTER databases are initialized
    registerModuleRoutes();
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();