import mongoose from "mongoose";

import dotenv from "dotenv";

dotenv.config();

// Store all database connections
let connections = {};

/**
 * Initialize all database connections from AVAILABLE_MODULES in .env
 * AVAILABLE_MODULES format: {"moduleName": "DB_URI_VAR_NAME", ...}
 */
export const initializeDatabaseConnections = async () => {
  try {
    // Parse AVAILABLE_MODULES from environment
    let modulesConfig = {};
    const modulesEnv = process.env.AVAILABLE_MODULES;
    console.log(modulesEnv);
    
    
    if (!modulesEnv) {
      throw new Error("AVAILABLE_MODULES is not defined in .env");
    }

    // Parse JSON from env variable
    try {
      modulesConfig = JSON.parse(modulesEnv);
    } catch (e) {
      throw new Error(`Invalid JSON in AVAILABLE_MODULES: ${e.message}`);
    }

    if (typeof modulesConfig !== 'object' || Array.isArray(modulesConfig)) {
      throw new Error("AVAILABLE_MODULES must be a JSON object");
    }

    // Connect to each database defined in AVAILABLE_MODULES
    for (const [moduleName, uriVarName] of Object.entries(modulesConfig)) {
      const uri = process.env[uriVarName];
      
      if (!uri) {
        console.warn(`⚠️  Database URI variable '${uriVarName}' not found in .env for module '${moduleName}'`);
        continue;
      }

      try {
        const conn = await mongoose.createConnection(uri);
        connections[moduleName] = conn;
        console.log(`✅ ${moduleName} DB connected`);
      } catch (err) {
        console.error(`❌ Failed to connect ${moduleName} DB:`, err.message);
        throw err;
      }
    }

    console.log(`\n✅ All available databases connected successfully (${Object.keys(connections).length} total)`);
    return connections;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
};

/**
 * Get database connection for a specific module
 * @param {string} moduleName - Name of the module (e.g., 'user', 'accounting', 'invoice')
 * @returns {mongoose.Connection} The database connection
 */
export const getDatabase = (moduleName) => {
  if (!connections[moduleName]) {
    throw new Error(`Database connection for module '${moduleName}' not found. Available: ${Object.keys(connections).join(', ')}`);
  }
  return connections[moduleName];
};

/**
 * Get names of all connected modules
 * @returns {string[]} Array of module names
 */
export const  getConnectedModules = async() => {

  const connection1 = await initializeDatabaseConnections();
  console.log('===================||=================');
  console.log(connection1);
  console.log('====================||================');
  return Object.keys(connection1);
};

/**
 * Check if a module is connected
 * @param {string} moduleName - Name of the module
 * @returns {boolean} True if connected
 */
export const isModuleConnected = (moduleName) => {
  return moduleName in connections;
};


