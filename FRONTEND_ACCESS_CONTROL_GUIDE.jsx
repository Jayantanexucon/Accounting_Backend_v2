/**
 * Frontend Access Control Integration Guide
 * 
 * This file shows how to implement access-based menu filtering and feature guards
 * in the React frontend to work with the backend access control middleware
 */

import { ENTITY_KEYS, PERMISSION_ACTIONS } from './constants/entityKeys';

/**
 * Example: NavbarComponent with Permission-Based Menu Filtering
 */

// Define your menu structure with entity keys
export const MAIN_MENU = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'Home',
    path: '/',
    entityKey: ENTITY_KEYS.DASHBOARD,
    action: PERMISSION_ACTIONS.VIEW,
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'Calculator',
    entityKey: ENTITY_KEYS.ACCOUNTS,
    action: PERMISSION_ACTIONS.VIEW,
    children: [
      {
        id: 'journals',
        label: 'Journal',
        path: '/accounting/journals',
        entityKey: ENTITY_KEYS.JOURNAL,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'groups',
        label: 'Groups',
        path: '/accounting/group',
        entityKey: ENTITY_KEYS.GROUPS,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'chart',
        label: 'Chart of Accounts',
        path: '/accounting/account',
        entityKey: ENTITY_KEYS.CHART_OF_ACCOUNTS,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'trial-balance',
        label: 'Trial Balance',
        path: '/accounting/trial',
        entityKey: ENTITY_KEYS.TRIAL_BALANCE,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'balance-sheet',
        label: 'Balance Sheet',
        path: '/accounting/sheet',
        entityKey: ENTITY_KEYS.BALANCE_SHEET,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'profit-loss',
        label: 'Profit & Loss',
        path: '/accounting/profit-loss',
        entityKey: ENTITY_KEYS.PROFIT_AND_LOSS,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'day-book',
        label: 'Day Book',
        path: '/accounting/day-books',
        entityKey: ENTITY_KEYS.DAY_BOOK,
        action: PERMISSION_ACTIONS.VIEW,
      },
    ],
  },
  {
    id: 'master-control',
    label: 'Master Control',
    icon: 'Settings',
    entityKey: ENTITY_KEYS.MASTER_CONTROL,
    action: PERMISSION_ACTIONS.VIEW,
    children: [
      {
        id: 'clients',
        label: 'Client Details',
        path: '/master-data/client-details',
        entityKey: ENTITY_KEYS.CLIENTS,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'vendors',
        label: 'Vendor Details',
        path: '/master-data/vendor-details',
        entityKey: ENTITY_KEYS.VENDOR,
        action: PERMISSION_ACTIONS.VIEW,
      },
      {
        id: 'hsn',
        label: 'HSN/SAC Codes',
        path: '/master-data/hsn-codes',
        entityKey: ENTITY_KEYS.HSN,
        action: PERMISSION_ACTIONS.VIEW,
      },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: 'FileText',
    path: '/invoice-data',
    entityKey: ENTITY_KEYS.INVOICE,
    action: PERMISSION_ACTIONS.VIEW,
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    icon: 'ShoppingCart',
    path: '/purchaseorder-data',
    entityKey: ENTITY_KEYS.PURCHASE_ORDER,
    action: PERMISSION_ACTIONS.VIEW,
  },
];

/**
 * Helper: Check if user has permission for an entity action
 */
export const userHasPermission = (userPermissions, entityKey, action) => {
  if (!userPermissions) return false;
  
  // SuperAdmin check (if your user object has this)
  if (userPermissions.isSuperAdmin) return true;
  
  // Find matching entity permission
  return userPermissions.some(permission => {
    // Check if entity matches (compare MongoDB ObjectIds or strings)
    const entityMatch = String(permission.entity) === String(entityKey);
    
    // Check if action is in the permission's actions array
    const actionMatch = Array.isArray(permission.actions) && 
                       permission.actions.includes(action);
    
    return entityMatch && actionMatch;
  });
};

/**
 * Helper: Check if user can view a menu item
 */
export const canViewMenuItem = (menuItem, userPermissions) => {
  if (!menuItem.entityKey) return true; // No permission check needed
  
  return userHasPermission(userPermissions, menuItem.entityKey, menuItem.action);
};

/**
 * Helper: Get filtered menu based on user permissions
 */
export const getFilteredMenu = (menu, userPermissions) => {
  return menu
    .filter(item => canViewMenuItem(item, userPermissions))
    .map(item => ({
      ...item,
      children: item.children 
        ? item.children.filter(child => canViewMenuItem(child, userPermissions))
        : undefined,
    }))
    .filter(item => !item.children || item.children.length > 0); // Remove empty parents
};

/**
 * React Component Example: Navbar with Permission Filtering
 */
export function NavbarComponent() {
  const { user } = useAuth(); // Your auth context
  
  // Get filtered menu based on user permissions
  const visibleMenu = getFilteredMenu(MAIN_MENU, user?.permissions);

  const renderMenuItem = (item) => {
    if (item.children) {
      return (
        <SubMenu key={item.id} title={item.label} icon={item.icon}>
          {item.children.map(child => renderMenuItem(child))}
        </SubMenu>
      );
    }

    return (
      <MenuItem 
        key={item.id}
        to={item.path}
        icon={item.icon}
      >
        {item.label}
      </MenuItem>
    );
  };

  return (
    <nav className="navbar">
      {visibleMenu.map(item => renderMenuItem(item))}
    </nav>
  );
}

/**
 * Component Guard: Show/Hide features based on permissions
 */
export function FeatureGuard({ entityKey, action, children, fallback = null }) {
  const { user } = useAuth();
  
  const hasPermission = userHasPermission(user?.permissions, entityKey, action);

  return hasPermission ? children : fallback;
}

/**
 * Usage Example in a Feature Component:
 */
export function JournalsPage() {
  const { user } = useAuth();
  
  const canCreate = userHasPermission(user?.permissions, ENTITY_KEYS.JOURNAL, PERMISSION_ACTIONS.CREATE);
  const canEdit = userHasPermission(user?.permissions, ENTITY_KEYS.JOURNAL, PERMISSION_ACTIONS.EDIT);
  const canDelete = userHasPermission(user?.permissions, ENTITY_KEYS.JOURNAL, PERMISSION_ACTIONS.DELETE);

  return (
    <div>
      <h1>Journals</h1>
      
      {/* Show Create button only if user has CREATE permission */}
      <FeatureGuard 
        entityKey={ENTITY_KEYS.JOURNAL} 
        action={PERMISSION_ACTIONS.CREATE}
      >
        <button onClick={openCreateModal}>+ Create Journal</button>
      </FeatureGuard>

      {/* Show Edit/Delete only if user has those permissions */}
      <JournalTable 
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

/**
 * Hook: usePermission
 * Convenient hook for checking permissions in components
 */
export function usePermission() {
  const { user } = useAuth();

  return {
    can: (entityKey, action) => userHasPermission(user?.permissions, entityKey, action),
    canView: (entityKey) => userHasPermission(user?.permissions, entityKey, PERMISSION_ACTIONS.VIEW),
    canCreate: (entityKey) => userHasPermission(user?.permissions, entityKey, PERMISSION_ACTIONS.CREATE),
    canEdit: (entityKey) => userHasPermission(user?.permissions, entityKey, PERMISSION_ACTIONS.EDIT),
    canDelete: (entityKey) => userHasPermission(user?.permissions, entityKey, PERMISSION_ACTIONS.DELETE),
    hasAny: (entityKeys) => entityKeys.some(key => userHasPermission(user?.permissions, key, PERMISSION_ACTIONS.VIEW)),
  };
}

/**
 * Usage Example with Hook:
 */
export function ClientDetailsPage() {
  const { can, canEdit, canDelete } = usePermission();

  return (
    <div>
      <h1>Clients</h1>
      
      {can(ENTITY_KEYS.CLIENTS, PERMISSION_ACTIONS.CREATE) && (
        <button>Add New Client</button>
      )}

      {canEdit(ENTITY_KEYS.CLIENTS) && (
        <button>Edit Client</button>
      )}

      {canDelete(ENTITY_KEYS.CLIENTS) && (
        <button>Delete Client</button>
      )}
    </div>
  );
}

/**
 * API Call Protection: Check permissions before API calls
 */
export async function createJournal(data) {
  const { can } = usePermission();
  
  if (!can(ENTITY_KEYS.JOURNAL, PERMISSION_ACTIONS.CREATE)) {
    throw new Error('You do not have permission to create journals');
  }

  return journalApi.create(data);
}

/**
 * Constants File: entityKeys.js
 * Import this in your frontend components:
 */
export const ENTITY_KEYS = {
  DASHBOARD: 'DASHBOARD',
  ACCOUNTS: 'ACCOUNTS',
  MASTER_CONTROL: 'MASTER CONTROL',
  INVOICE: 'INVOICE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  
  JOURNAL: 'JOURNAL',
  GROUPS: 'GROUPS',
  TRIAL_BALANCE: 'TRIAL BALANCE',
  PROFIT_AND_LOSS: 'PROFIT AND LOSS',
  BALANCE_SHEET: 'BALANCE SHEET',
  DAY_BOOK: 'DAY BOOK',
  CHART_OF_ACCOUNTS: 'CHART OF ACCOUNTS',
  ACCOUNT_TYPE: 'ACCOUNT_TYPE',
  
  CLIENTS: 'CLIENTS',
  VENDOR: 'VENDOR',
  HSN: 'HSN',
  
  PAYMENT: 'PAYMENT',
  CONTRA: 'CONTRA',
};

export const PERMISSION_ACTIONS = {
  CREATE: 'CREATE',
  VIEW: 'VIEW',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
};

/**
 * Implementation Steps:
 * 
 * 1. Copy ENTITY_KEYS and PERMISSION_ACTIONS constants to frontend
 * 2. Import constants in your NavbarComponent
 * 3. Use getFilteredMenu() to filter menu items based on user permissions
 * 4. Add FeatureGuard components around features that need permission checks
 * 5. Use usePermission hook for convenient permission checks
 * 6. Test that unauthorized users see the correct UI (no buttons/menu items)
 * 7. Verify backend returns 403 when API calls are made without permission
 */
