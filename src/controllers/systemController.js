import ApiResponse from "../utils/ApiResponse.js";

/**
 * System Controller
 * Handles system-level endpoints like module discovery, health checks, etc.
 */

/**
 * Get available modules
 * Public endpoint - no authentication required
 * Allows clients to discover which modules are enabled
 */
export const getAvailableModules = (req, res, next) => {
  try {
    // Parse available modules from environment variable
    const availableModulesStr = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    // Define module metadata
    const moduleMetadata = {
      accounting: {
        name: "Accounting Module",
        path: "/api/accounting",
        enabled: availableModulesStr.includes("accounting"),
        description: "Core accounting features including accounts, journals, groups, and financial reporting",
        features: [
          "Account management",
          "Journal entries",
          "Trial balance",
          "Financial statements (Balance Sheet, P&L)",
          "Ledger reports",
          "Account groups with Schedule III classification",
        ],
        database: "accounting_db",
        status: availableModulesStr.includes("accounting") ? "active" : "disabled",
      },
      invoice: {
        name: "Invoice Module",
        path: "/api/invoice",
        enabled: availableModulesStr.includes("invoice"),
        description: "Invoice and purchase order management with milestones and payment tracking",
        features: [
          "Invoice creation and management",
          "Purchase order handling",
          "Milestone-based billing",
          "Payment tracking",
          "Document export (PDF/Word)",
          "Payment notifications",
          "Cross-database transactions",
        ],
        database: "invoice_db",
        status: availableModulesStr.includes("invoice") ? "active" : "disabled",
      },
      auth: {
        name: "Authentication Module",
        path: "/api/auth",
        enabled: true,
        description: "User authentication and authorization with JWT and Azure AD support",
        features: [
          "JWT-based authentication",
          "Azure AD integration",
          "Token refresh",
          "Role-based access control (RBAC)",
          "Audit logging for auth events",
        ],
        database: "user_db",
        status: "active",
      },
      users: {
        name: "User Management Module",
        path: "/api/users",
        enabled: true,
        description: "User profile and management endpoints",
        features: [
          "User CRUD operations",
          "User roles and permissions",
          "User profile management",
        ],
        database: "user_db",
        status: "active",
      },
      companies: {
        name: "Company Module",
        path: "/api/companies",
        enabled: true,
        description: "Multi-tenant company management",
        features: [
          "Company CRUD operations",
          "Company settings",
          "Company-scoped data isolation",
        ],
        database: "company_db",
        status: "active",
      },
      masterData: {
        name: "Master Data Module",
        path: "/api/masterData",
        enabled: true,
        description: "Master data management including clients, vendors, and configuration",
        features: [
          "Client management",
          "Vendor management",
          "HSN/SAC codes",
          "Entity management",
        ],
        database: "master_db",
        status: "active",
      },
    };

    // Build response
    const enabledModules = availableModulesStr.filter((m) => moduleMetadata[m]);
    const coreModules = ["auth", "users", "companies", "masterData"]; // Always available
    const allAvailableModules = [...new Set([...coreModules, ...enabledModules])];

    const response = {
      server: {
        environment: process.env.NODE_ENV || "development",
        port: process.env.PORT || 8080,
      },
      modules: {
        available: allAvailableModules,
        count: allAvailableModules.length,
        enabledOptionalModules: enabledModules,
        coreModules: coreModules,
      },
      details: {},
    };

    // Add metadata for all available modules
    for (const module of allAvailableModules) {
      if (moduleMetadata[module]) {
        response.details[module] = moduleMetadata[module];
      }
    }

    // Add disabled modules info
    const allModules = Object.keys(moduleMetadata);
    const disabledModules = allModules.filter((m) => !allAvailableModules.includes(m));
    if (disabledModules.length > 0) {
      response.modules.disabled = disabledModules;
      response.disabledDetails = {};
      for (const module of disabledModules) {
        response.disabledDetails[module] = {
          name: moduleMetadata[module].name,
          path: moduleMetadata[module].path,
          enabled: false,
          status: "disabled",
          reason: "Not enabled in AVAILABLE_MODULE environment variable",
        };
      }
    }

    new ApiResponse({
      statusCode: 200,
      data: response,
      message: `${allAvailableModules.length} modules available`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get module status
 * Check if a specific module is enabled
 * Query params: ?module=accounting
 */
export const getModuleStatus = (req, res, next) => {
  try {
    const { module } = req.query;

    if (!module) {
      return res.status(400).json({
        statusCode: 400,
        message: "Module name is required as query parameter: ?module=accounting",
        error: "getModuleStatus",
      });
    }

    const availableModulesStr = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    const moduleName = module.toLowerCase().trim();
    const coreModules = ["auth", "users", "companies", "masterData"];
    
    // Check if module is available
    const isCore = coreModules.includes(moduleName);
    const isOptional = availableModulesStr.includes(moduleName);
    const isEnabled = isCore || isOptional;

    const status = {
      module: moduleName,
      enabled: isEnabled,
      type: isCore ? "core" : isOptional ? "optional" : "unknown",
      status: isEnabled ? "active" : "disabled",
    };

    if (!isEnabled) {
      status.message = `Module "${moduleName}" is not available. Enable it by adding to AVAILABLE_MODULE environment variable.`;
    } else {
      status.message = `Module "${moduleName}" is available and active.`;
    }

    new ApiResponse({
      statusCode: isEnabled ? 200 : 404,
      data: status,
      message: status.message,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get system health and database status
 * Shows which databases are connected
 */
export const getSystemHealth = (req, res, next) => {
  try {
    const availableModulesStr = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    const health = {
      server: {
        status: "healthy",
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        port: process.env.PORT || 8080,
        timestamp: new Date().toISOString(),
      },
      databases: {
        core: {
          user_db: { required: true, optional: false },
          company_db: { required: true, optional: false },
          audit_db: { required: true, optional: false },
          master_db: { required: true, optional: false },
        },
        optional: {
          invoice_db: {
            required: false,
            optional: true,
            enabled: availableModulesStr.includes("invoice"),
          },
          accounting_db: {
            required: false,
            optional: true,
            enabled: availableModulesStr.includes("accounting"),
          },
        },
      },
      modules: {
        enabled: availableModulesStr.length > 0 ? availableModulesStr : [],
        count: availableModulesStr.length,
      },
    };

    new ApiResponse({
      statusCode: 200,
      data: health,
      message: "System health check passed",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export default {
  getAvailableModules,
  getModuleStatus,
  getSystemHealth,
};
