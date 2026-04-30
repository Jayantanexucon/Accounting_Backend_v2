import ApiResponse from "../utils/ApiResponse.js";
import AppError from "../utils/AppError.js";
import { getConnectedModules } from "../config/databases.js";

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
    // Get connected modules from database configuration
    const connectedModules = getConnectedModules();

    // Define module metadata
    const moduleMetadata = {
      accounting: {
        name: "Accounting Module",
        path: "/api/accounting",
        enabled: connectedModules.includes("accounting"),
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
        status: connectedModules.includes("accounting") ? "active" : "disabled",
      },
      invoice: {
        name: "Invoice Module",
        path: "/api/invoice",
        enabled: connectedModules.includes("invoice"),
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
        status: connectedModules.includes("invoice") ? "active" : "disabled",
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
    const enabledOptionalModules = connectedModules.filter((m) => ["accounting", "invoice"].includes(m));
    const coreModules = ["auth", "users", "companies", "masterData"]; // Always available
    const allAvailableModules = [...new Set([...coreModules, ...enabledOptionalModules])];

    const response = {
      server: {
        environment: process.env.NODE_ENV || "development",
        port: process.env.PORT || 8080,
      },
      modules: {
        available: allAvailableModules,
        count: allAvailableModules.length,
        enabledOptionalModules: enabledOptionalModules,
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
          reason: "Not enabled in AVAILABLE_MODULES environment variable",
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

    // ✅ getConnectedModules() is now synchronous (uses cached connections)
    const connectedModules = getConnectedModules();
    const moduleName = module.toLowerCase().trim();
    const coreModules = ["auth", "users", "companies", "masterData"];
    
    // Check if module is available
    const isCore = coreModules.includes(moduleName);
    const isConnected = connectedModules.includes(moduleName);
    const isEnabled = isCore || isConnected;

    const status = {
      module: moduleName,
      enabled: isEnabled,
      type: isCore ? "core" : isConnected ? "optional" : "unknown",
      status: isEnabled ? "active" : "disabled",
    };

    if (!isEnabled) {
      status.message = `Module "${moduleName}" is not available. Enable it by adding to AVAILABLE_MODULES environment variable.`;
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
    const connectedModules = getConnectedModules();

    const health = {
      server: {
        status: "healthy",
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        port: process.env.PORT || 8080,
        timestamp: new Date().toISOString(),
      },
      databases: {
        connected: connectedModules,
        count: connectedModules.length,
        details: {},
      },
      modules: {
        coreModules: ["auth", "users", "companies", "masterData"],
        optionalModules: connectedModules.filter((m) => ["accounting", "invoice"].includes(m)),
      },
    };

    // Add database status details
    const dbMapping = {
      user: "user_db",
      company: "company_db",
      audit: "audit_db",
      master: "master_db",
      invoice: "invoice_db",
      accounting: "accounting_db",
    };

    for (const [moduleName, dbName] of Object.entries(dbMapping)) {
      health.databases.details[dbName] = {
        module: moduleName,
        connected: connectedModules.includes(moduleName),
        status: connectedModules.includes(moduleName) ? "healthy" : "disconnected",
      };
    }

    new ApiResponse({
      statusCode: 200,
      data: health,
      message: "System health check passed",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's accessible modules with their permissions
 * Requires authentication - returns only modules user has access to
 * Used to dynamically populate navigation/entity menu in frontend
 */
export const getUserAccessibleModules = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const companyId = req.query.companyId;

    if (!userId) {
      throw new AppError("User not authenticated", 401, "getUserAccessibleModules");
    }

    if (!companyId) {
      throw new AppError("Company ID is required", 400, "getUserAccessibleModules");
    }

    // Get user from database
    const User = await import("../modules/user/models/User.js").then(m => m.getUserModel());
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found", 404, "getUserAccessibleModules");
    }

    // Parse available modules from environment
    const availableModulesStr = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    // Define module metadata
    const moduleMetadata = {
      accounting: {
        name: "Accounting Module",
        path: "/api/accounting",
        icon: "Calculator",
        enabled: availableModulesStr.includes("accounting"),
        description: "Core accounting features including accounts, journals, groups, and financial reporting",
        features: [
          { id: "accounts", name: "Accounts", icon: "DollarSign", path: "/api/accounting/account" },
          { id: "journals", name: "Journals", icon: "BookOpen", path: "/api/accounting/journal" },
          { id: "groups", name: "Groups", icon: "Layers", path: "/api/accounting/group" },
          { id: "trial-balance", name: "Trial Balance", icon: "Scale", path: "/api/accounting/report/:companyId/trial-balance" },
          { id: "profit-loss", name: "Profit And Loss", icon: "TrendingUp", path: "/api/accounting/report/:companyId/profit-loss" },
          { id: "balance-sheet", name: "Balance Sheet", icon: "BarChart3", path: "/api/accounting/report/:companyId/balance-sheet" },
          { id: "ledger", name: "Ledger", icon: "BookMarked", path: "/api/accounting/report/:companyId/ledger" },
          { id: "day-book", name: "Day Book", icon: "Calendar", path: "/api/accounting/journal" },
        ],
        database: "accounting_db",
        status: availableModulesStr.includes("accounting") ? "active" : "disabled",
      },
      invoice: {
        name: "Invoice Module",
        path: "/api/invoice",
        icon: "FileText",
        enabled: availableModulesStr.includes("invoice"),
        description: "Invoice and purchase order management with milestones and payment tracking",
        features: [
          { id: "invoices", name: "Invoice", icon: "DollarSign", path: "/api/invoice" },
          { id: "purchase-orders", name: "Purchase Order", icon: "Package", path: "/api/invoice/po" },
        ],
        database: "invoice_db",
        status: availableModulesStr.includes("invoice") ? "active" : "disabled",
      },
      masterData: {
        name: "Master Control",
        path: "/api/masterData",
        icon: "Database",
        enabled: true,
        description: "Master data management including clients, vendors, and configuration",
        features: [
          { id: "clients", name: "Client Details", icon: "Users", path: "/api/masterData/client" },
          { id: "vendors", name: "Vendor", icon: "Briefcase", path: "/api/masterData/vendor" },
          { id: "hsn", name: "HSN/SAC Codes", icon: "Tag", path: "/api/masterData/hsn" },
          // { id: "entities", name: "Testing", icon: "BarChart", path: "/api/masterData/entity" },
        ],
        database: "master_db",
        status: "active",
      },
    };

    // Get user permissions for this company
    const userPermissions = user.permissions.find(p => p.companyId?.toString() === companyId) || {};
    const allowedEntities = userPermissions.entityId ? [userPermissions.entityId] : [];
    const allowedActions = userPermissions.actions || [];

    // Build accessible modules based on user role and permissions
    let accessibleModules = [];

    // Superadmin and admin get all modules
    if (user.role === "superAdmin" || user.role === "admin") {
      accessibleModules = ["accounting", "invoice", "masterData"].filter(m => moduleMetadata[m].enabled || m === "masterData");
    } else {
      // Regular users get modules based on permissions
      if (allowedEntities.includes("accounting")) {
        accessibleModules.push("accounting");
      }
      if (allowedEntities.includes("invoice")) {
        accessibleModules.push("invoice");
      }
      accessibleModules.push("masterData");
    }

    // Build response with only accessible modules
    const response = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId,
      },
      modules: {
        accessible: accessibleModules,
        count: accessibleModules.length,
      },
      details: {},
      permissions: {
        allowedEntities: allowedEntities,
        allowedActions: allowedActions,
      },
    };

    // Add metadata for accessible modules only
    for (const module of accessibleModules) {
      if (moduleMetadata[module]) {
        const moduleData = { ...moduleMetadata[module] };

        // Filter features based on user permissions for regular users
        if (user.role !== "superAdmin" && user.role !== "admin") {
          // If user has specific permissions, only show permitted features
          if (allowedActions.length > 0) {
            moduleData.features = moduleData.features.filter(f => 
              allowedActions.includes("VIEW") || allowedActions.includes("READ")
            );
          }
        }

        response.details[module] = moduleData;
      }
    }

    new ApiResponse({
      statusCode: 200,
      data: response,
      message: `${accessibleModules.length} modules available for ${user.name}`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's entity permissions for navigation/entity list population
 * Returns entities and features the user can access
 * Used for filtering navigation menu and entity table in frontend
 */
export const getUserEntityPermissions = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const companyId = req.query.companyId;

    if (!userId) {
      throw new AppError("User not authenticated", 401, "getUserEntityPermissions");
    }

    if (!companyId) {
      throw new AppError("Company ID is required", 400, "getUserEntityPermissions");
    }

    // Get user from database
    const User = await import("../modules/user/models/User.js").then(m => m.getUserModel());
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found", 404, "getUserEntityPermissions");
    }

    // Get Entity model from masterData DB
    const Entity = await import("../modules/masterData/models/Entity.js").then(m => m.getEntityModel());

    // Fetch all entities and populate parent references
    const allEntities = await Entity.find({})
      .populate("parent", "_id name key navLink isNavItem system")
      .lean();

    // Parse available modules from environment
    const availableModulesStr = (process.env.AVAILABLE_MODULE || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    // Get user permissions for this company
    const userCompanyPermissions = user.permissions.filter(
      p => p.company?.toString() === companyId || p.companyId?.toString() === companyId
    );

    // Extract accessible entity IDs from user permissions
    const accessibleEntityIds = new Set(
      userCompanyPermissions.map(p => 
        typeof p.entity === "object" ? p.entity._id?.toString() : p.entity?.toString()
      )
    );

    // Function to check if entity is enabled based on available modules
    const isEntityEnabled = (entity) => {
      const key = entity.key?.toLowerCase();
      
      // Always enabled entities (core modules)
      if (["dashboard", "clients", "vendor", "hsn/sac codes", "testing"].some(k => key?.includes(k))) {
        return true;
      }

      // Check if accounting-related entities are enabled
      if (availableModulesStr.includes("accounting")) {
        if (["accounting", "journal", "groups", "trial balance", "profit and loss", 
             "balance sheet", "day book", "chart of accounts", "contra", "ledger"].some(k => key?.includes(k))) {
          return true;
        }
      }

      // Check if invoice-related entities are enabled
      if (availableModulesStr.includes("invoice")) {
        if (["invoice", "purchase order"].some(k => key?.includes(k))) {
          return true;
        }
      }

      return false;
    };

    // Filter entities based on user role and permissions
    let accessibleEntities = [];

    if (user.role === "superAdmin") {
      // SuperAdmin sees all enabled entities
      accessibleEntities = allEntities.filter(isEntityEnabled);
    } else if (user.role === "admin") {
      // Admin sees all enabled entities
      accessibleEntities = allEntities.filter(isEntityEnabled);
    } else {
      // Regular user sees only:
      // 1. Entities they have explicit permission for
      // 2. Parent entities of entities they have permission for (for navigation hierarchy)
      const permittedEntityIds = new Set(accessibleEntityIds);

      // Add parent entities recursively to maintain hierarchy
      for (const entityId of permittedEntityIds) {
        let currentEntity = allEntities.find(e => e._id?.toString() === entityId.toString());
        while (currentEntity?.parent) {
          permittedEntityIds.add(currentEntity.parent._id?.toString());
          currentEntity = allEntities.find(e => e._id?.toString() === currentEntity.parent._id?.toString());
        }
      }

      // Always include Master Control and Dashboard
      const dashboardEntity = allEntities.find(e => e.key === "DASHBOARD");
      const masterControlEntity = allEntities.find(e => e.key === "MASTER CONTROL");
      
      accessibleEntities = allEntities.filter(entity => 
        isEntityEnabled(entity) && (
          permittedEntityIds.has(entity._id?.toString()) ||
          entity._id?.toString() === dashboardEntity?._id?.toString() ||
          entity._id?.toString() === masterControlEntity?._id?.toString()
        )
      );
    }

    // Build response with user's specific permissions for each entity
    const entityResponse = accessibleEntities.map(entity => {
      // Find user's specific permissions for this entity
      const entityPermission = userCompanyPermissions.find(p => 
        (typeof p.entity === "object" ? p.entity._id?.toString() : p.entity?.toString()) === entity._id?.toString()
      );

      return {
        _id: entity._id,
        name: entity.name,
        key: entity.key,
        isNavItem: entity.isNavItem,
        system: entity.system,
        navLink: entity.navLink,
        parent: entity.parent || null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        // User's specific permissions for this entity
        userPermissions: {
          actions: entityPermission?.actions || (user.role === "superAdmin" || user.role === "admin" ? ["VIEW", "CREATE", "EDIT", "DELETE"] : []),
          canView: true,
          canCreate: user.role === "superAdmin" || user.role === "admin" || entityPermission?.actions?.includes("CREATE") || false,
          canEdit: user.role === "superAdmin" || user.role === "admin" || entityPermission?.actions?.includes("EDIT") || false,
          canDelete: user.role === "superAdmin" || entityPermission?.actions?.includes("DELETE") || false,
        },
      };
    });

    // Separate root entities and child entities for better structure
    const rootEntities = entityResponse.filter(e => !e.parent);
    const childEntities = entityResponse.filter(e => e.parent);

    const response = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId,
      },
      data: entityResponse,
      summary: {
        total: entityResponse.length,
        rootEntities: rootEntities.length,
        childEntities: childEntities.length,
      },
      structure: {
        roots: rootEntities,
        children: childEntities,
      },
    };

    new ApiResponse({
      statusCode: 200,
      data: response,
      message: `${entityResponse.length} entities available for ${user.name}`,
    }).send(res);
  } catch (error) {
    next(error);
  }
};



