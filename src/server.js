import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app, { initializeDatabases, registerModuleRoutes, registerErrorHandlers } from "./app.js";
import { configurePassport } from "./config/passport.js";
import { initializeSocket } from "./utils/socketHandler.js";

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    // Configure Passport strategies
    configurePassport();
    
    // Initialize databases first
    await initializeDatabases();
    
    // ✅ Register module routes AFTER databases are initialized
    registerModuleRoutes();
    
    // ✅ Register error handlers AFTER all routes are registered
    registerErrorHandlers();
    
    const httpServer = createServer(app);
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();