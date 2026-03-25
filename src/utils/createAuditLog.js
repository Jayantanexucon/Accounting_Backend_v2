// For now, audit logging is optional in new structure
// This is a placeholder that can be connected to audit DB later
export const createAuditLog = async ({
  companyId,
  module,
  entityId,
  actionType,
  logs,
  userId,
  session,
}) => {
  try {
    console.log("Audit log:", {
      companyId,
      module,
      entityId,
      actionType,
      performedBy: userId,
      timestamp: new Date(),
    });
    // TODO: Implement when audit DB is ready
    // await AuditLog.create([{ ... }], session ? { session } : {})
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
};
