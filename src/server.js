import dotenv from "dotenv";
dotenv.config();

import app, { initializeDatabases } from "./app.js";
import { configurePassport } from "./config/passport.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Configure Passport strategies
    configurePassport();
    
    await initializeDatabases();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();