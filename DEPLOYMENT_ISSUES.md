# CRITICAL: AVAILABLE_MODULES Deployment Issues

## 🔴 Issue #1: Missing `await` in systemController.js (Will Break Deployment)

**Location**: [src/controllers/systemController.js](src/controllers/systemController.js#L179)

**Problem**: 
```javascript
// ❌ WRONG - Line 179
const connectedModules = getConnectedModules();  // Missing await!
```

`getConnectedModules()` is an **async function** but called **without `await`**. This returns a Promise, not an array.

**Impact**:
- `connectedModules.includes(moduleName)` will FAIL because you can't call `.includes()` on a Promise
- Module status check will always return "disabled"
- This gets called synchronously in a sync controller function (can't await)

**Current Code**:
```javascript
export const getModuleStatus = (req, res, next) => {  // ← SYNC function
  try {
    const { module } = req.query;
    const connectedModules = getConnectedModules();  // ← Returns Promise, not array!
    const isConnected = connectedModules.includes(moduleName);  // ← WILL CRASH
```

---

## 🔴 Issue #2: Double Database Initialization (Performance & Concurrency Issues)

**Locations**: 
- [src/app.js](src/app.js#L40-45) - `initializeDatabases()` calls `initializeDatabaseConnections()`
- [src/app.js](src/app.js#L69) - Then calls `getConnectedModules()` which calls `initializeDatabaseConnections()` AGAIN
- [src/config/databases.js](src/config/databases.js#L81-86) - `getConnectedModules()` reinitializes everything

**Problem**:
```javascript
// server.js
await initializeDatabases();  // ← Connects all databases (1st time)

// app.js
const connectedModules = await getConnectedModules();  // ← Connects AGAIN (2nd time!)
```

**Impact**:
- Mongoose creates duplicate connections
- Memory leaks (old connections never closed)
- Port conflicts if Mongoose strict mode is enabled
- In Azure deployment with auto-scaling, each pod creates redundant connections

---

## 🔴 Issue #3: Architecture - `connections` Object Not Exported

**Problem**:
The `connections` object in [databases.js](src/config/databases.js#L8) is module-local:
```javascript
let connections = {};  // ← Private to this module

export const getConnectedModules = async() => {
  const connection1 = await initializeDatabaseConnections();
  return Object.keys(connection1);  // ← Returns from reinit, not from stored connections
};
```

This forces reinitialization every time you need the module list.

---

## 🟡 Issue #4: JSON Parsing in Azure (Potential)

**Location**: [src/config/databases.js](src/config/databases.js#L18-30)

**Current Code**:
```javascript
const modulesEnv = process.env.AVAILABLE_MODULES;
modulesConfig = JSON.parse(modulesEnv);
```

**Potential Issue in Azure**:
- If Azure escapes the JSON differently, it may fail to parse
- If `AVAILABLE_MODULES` is not set in Azure settings, app crashes
- No fallback or default configuration

---

## 📋 Summary Table

| Issue | Severity | Impact | Deploy Readiness |
|-------|----------|--------|------------------|
| Missing await in systemController | 🔴 CRITICAL | Module status always fails | ❌ WILL CRASH |
| Double database init | 🔴 CRITICAL | Memory leaks, port conflicts | ❌ WILL FAIL |
| Missing connections export | 🟡 HIGH | Performance issues | ⚠️ DEGRADED |
| JSON parsing in Azure | 🟡 MEDIUM | Startup failure if misconfigured | ⚠️ RISKY |

---

## ✅ Recommended Fixes

### FIX #1: Refactor to use cached connections (Priority: CRITICAL)

```javascript
// src/config/databases.js
let connections = {};
let modulesInitialized = false;

export const initializeDatabaseConnections = async () => {
  if (modulesInitialized) {
    console.log("✅ Using cached database connections");
    return connections;
  }
  
  // ... existing connection logic ...
  modulesInitialized = true;
  return connections;
};

export const getConnectedModules = () => {
  if (!modulesInitialized) {
    throw new Error("Databases not initialized. Call initializeDatabaseConnections() first.");
  }
  return Object.keys(connections);
};
```

### FIX #2: Add await to systemController (Priority: CRITICAL)

Make `getModuleStatus` async:
```javascript
export const getModuleStatus = async (req, res, next) => {  // ← Add async
  try {
    const { module } = req.query;
    const connectedModules = await getConnectedModules();  // ← Add await
```

### FIX #3: Add validation in app.js

```javascript
if (!process.env.AVAILABLE_MODULES) {
  throw new Error("AVAILABLE_MODULES environment variable is required!");
}

try {
  JSON.parse(process.env.AVAILABLE_MODULES);
} catch (e) {
  throw new Error(`Invalid JSON in AVAILABLE_MODULES: ${e.message}`);
}
```

### FIX #4: Set default AVAILABLE_MODULES in .env.example

```env
# For production, ensure all required modules are enabled
AVAILABLE_MODULES={"user": "USER_DB_URI", "company": "COMPANY_DB_URI", "audit": "AUDIT_DB_URI", "master": "MASTER_DB_URI", "accounting": "ACCOUNTING_DB_URI", "invoice": "INVOICE_DB_URI"}
```

---

## ⚠️ For Azure Deployment

When setting `AVAILABLE_MODULES` in Azure App Service:

**Portal UI**:
```
Name: AVAILABLE_MODULES
Value: {"user": "USER_DB_URI", "company": "COMPANY_DB_URI", "audit": "AUDIT_DB_URI", "master": "MASTER_DB_URI", "accounting": "ACCOUNTING_DB_URI", "invoice": "INVOICE_DB_URI"}
```

**Verify with Azure CLI**:
```bash
az webapp config appsettings list --resource-group <rg> --name <app-name> | grep AVAILABLE_MODULES
```

The value should be **exactly as shown above** without extra escaping.
