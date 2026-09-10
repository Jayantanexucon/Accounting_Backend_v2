/**
 * Initialize default entities in the system with hierarchical structure
 * This creates the base module entities with parent-child relationships
 */

import { getEntityModel } from "../modules/masterData/models/Entity.js";
import AppError from "./AppError.js";

/**
 * Initialize entities with hierarchical structure
 * This function migrates old flat entities to hierarchical structure
 */
export const initializeEntities = async () => {
  try {
    const Entity = await getEntityModel();
    console.log("📋 Setting up hierarchical entity structure...");

    // Step 1: Create or find parent entities (ROOT level)
    const parentEntities = [
      {
        name: "Dashboard",
        key: "DASHBOARD",
        isNavItem: true,
        navLink: "/",
        system: false,
      },
      {
        name: "Accounting",
        key: "ACCOUNTS",
        isNavItem: false,
        navLink: "",
        system: true,
      },
      {
        name: "Master Control",
        key: "MASTER CONTROL",
        isNavItem: false,
        navLink: "",
        system: true,
      },
      {
        name: "Invoice",
        key: "INVOICE",
        isNavItem: true,
        navLink: "/invoice-data",
        system: false,
      },
      {
        name: "Purchase Order",
        key: "PURCHASE ORDER",
        isNavItem: true,
        navLink: "/purchaseorder-data",
        system: false,
      },
      // {
      //   name: "Admin Settings",
      //   key: "ADMIN_SETTINGS",
      //   isNavItem: false,
      //   navLink: "",
      //   system: true,
      // },
    ];

    const parentMap = {};
    for (const parentData of parentEntities) {
      try {
        let parentEntity = await Entity.findOne({ key: parentData.key });
        if (!parentEntity) {
          parentEntity = await Entity.create(parentData);
          console.log(`   ✅ Parent entity created: ${parentData.key}`);
        } else {
          console.log(`   ℹ️  Parent entity found: ${parentData.key}`);
        }
        parentMap[parentData.key] = parentEntity._id;
      } catch (error) {
        if (error.code !== 11000) {
          console.error(`   ⚠️  Error with parent entity ${parentData.key}:`, error.message);
        }
      }
    }

    // Step 2: Create child entities with parent references
    const childEntities = [
      // Accounting children
      {
        name: "Journal",
        key: "JOURNAL",
        isNavItem: true,
        navLink: "/accounting/journals",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Groups",
        key: "GROUPS",
        isNavItem: true,
        navLink: "/accounting/group",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Trial Balance",
        key: "TRIAL BALANCE",
        isNavItem: true,
        navLink: "/accounting/trial",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Profit And Loss",
        key: "PROFIT AND LOSS",
        isNavItem: true,
        navLink: "/accounting/profit-loss",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Balance Sheet",
        key: "BALANCE SHEET",
        isNavItem: true,
        navLink: "/accounting/sheet",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Day Book",
        key: "DAY BOOK",
        isNavItem: true,
        navLink: "/accounting/day-books",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Ledger",
        key: "CHART OF ACCOUNTS",
        isNavItem: true,
        navLink: "/accounting/account",
        system: false,
        parentKey: "ACCOUNTS",
      },
      {
        name: "Expense Audit",
        key: "EXPENSE AUDIT",
        isNavItem: true,
        navLink: "/accounting/expense-audit",
        system: false,
        parentKey: "ACCOUNTS",
      },

      // Master Control children
      {
        name: "Client Details",
        key: "CLIENTS",
        isNavItem: true,
        navLink: "master-data/client-details",
        system: false,
        parentKey: "MASTER CONTROL",
      },
      {
        name: "Vendor",
        key: "VENDOR",
        isNavItem: true,
        navLink: "master-data/vendor-details",
        system: false,
        parentKey: "MASTER CONTROL",
      },
      {
        name: "HSN/SAC Codes",
        key: "HSN",
        isNavItem: true,
        navLink: "master-data/hsn-codes",
        system: false,
        parentKey: "MASTER CONTROL",
      },
      // {
      //   name: "Testing",
      //   key: "TESTING",
      //   isNavItem: true,
      //   navLink: "master-data/entity",
      //   system: false,
      //   parentKey: "MASTER CONTROL",
      // },

      // Admin Settings children
      // {
      //   name: "User Management",
      //   key: "USER_MANAGEMENT",
      //   isNavItem: true,
      //   navLink: "/admin/users",
      //   system: false,
      //   parentKey: "ADMIN_SETTINGS",
      // },
      // {
      //   name: "Access Management",
      //   key: "ACCESS_MANAGEMENT",
      //   isNavItem: true,
      //   navLink: "/admin/access",
      //   system: false,
      //   parentKey: "ADMIN_SETTINGS",
      // },

      // Special grandchild
      {
        name: "Contra",
        key: "CONTRA",
        isNavItem: true,
        navLink: "",
        system: true,
        parentKey: "JOURNAL",
      },
    ];

    // Create child entities
    for (const childData of childEntities) {
      try {
        // Check if entity already exists by key
        const exists = await Entity.findOne({ key: childData.key });
        
        if (exists) {
          console.log(`   ℹ️  Child entity already exists: ${childData.key}`);
          continue;
        }

        // Get parent ID
        const parentKey = childData.parentKey;
        let parentId = null;

        // First check if parent is in parentMap (top-level parents)
        if (parentMap[parentKey]) {
          parentId = parentMap[parentKey];
        } else {
          // Otherwise, query for the parent entity by key (for grandchildren like CONTRA)
          const parentEntity = await Entity.findOne({ key: parentKey });
          if (parentEntity) {
            parentId = parentEntity._id;
          }
        }

        if (!parentKey || !parentId) {
          console.log(`   ⚠️  Parent not found for ${childData.key}`);
          continue;
        }

        // Create child entity
        const entityData = {
          name: childData.name,
          key: childData.key,
          isNavItem: childData.isNavItem,
          navLink: childData.navLink,
          system: childData.system,
          parent: parentId,
        };

        await Entity.create(entityData);
        console.log(`   ✅ Child entity created: ${childData.key}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`   ℹ️  Child entity key already exists: ${childData.key}`);
        } else {
          console.log(`   ⚠️  Error creating child entity ${childData.key}: ${error.message}`);
        }
      }
    }

    console.log(`✅ Entity hierarchy setup completed!`);
  } catch (error) {
    console.error("❌ Failed to initialize entities:", error.message);
    throw new AppError("Failed to initialize entities", 500, "initializeEntities");
  }
};

/**
 * Get entity by key
 * Useful for checking if an entity exists during permission assignment
 */
export const getEntityByKey = async (key) => {
  try {
    const Entity = await getEntityModel();
    return await Entity.findOne({ key });
  } catch (error) {
    throw new AppError(
      `Failed to get entity by key: ${error.message}`,
      500,
      "getEntityByKey"
    );
  }
};

/**
 * Seed permissions for a user with basic access
 * This is useful for quickly setting up new users with starter permissions
 */
export const seedUserPermissions = async (userId, companyId, entityKeys = [], actions = ["VIEW"]) => {
  try {
    const Entity = await getEntityModel();

    const permissions = [];

    for (const key of entityKeys) {
      const entity = await Entity.findOne({ key });
      if (entity) {
        permissions.push({
          entity: entity._id.toString(),
          company: companyId,
          actions,
        });
      }
    }

    return permissions;
  } catch (error) {
    throw new AppError(
      `Failed to seed permissions: ${error.message}`,
      500,
      "seedUserPermissions"
    );
  }
};
