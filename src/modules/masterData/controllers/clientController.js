import {
  createClientRepo,
  findClientRepo,
  findClientsRepo,
  findClientByIdRepo,
  updateClientRepo,
  deleteClientRepo,
  getPaginatedClientsRepo,
} from "../repos/clientRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

// Generate clientCode
const generateClientCode = () => {
  return "CLI-" + Math.floor(1000 + Math.random() * 9000);
};

export const createClientController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const data = req.body;
    const userId = req.user?._id;

    if (!data.clientName) {
      throw new AppError("Client name is required", 400, "createClientController");
    }

    // Generate client code automatically
    if (!data.clientCode) {
      data.clientCode = generateClientCode();
    }

    const client = await createClientRepo({
      companyId,
      ...data,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      companyId,
      module: "CLIENT",
      entityId: client._id,
      actionType: "CLIENT_CREATED",
      logs: [
        {
          field: "client",
          oldValue: null,
          newValue: { clientName: client.clientName, clientCode: client.clientCode },
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Client created successfully",
      data: client,
      statusCode: 201,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getClientsController = async (req, res, next) => {
  try {
    const companyId = req.query.companyId || req.params.companyId;
    const clients = await findClientsRepo({ companyId }, true);

    return new ApiResponse({
      message: "Clients fetched successfully",
      data: clients,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getClientByIdController = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const client = await findClientByIdRepo(clientId, {}, false);

    if (!client) {
      throw new AppError("Client not found", 404, "getClientByIdController");
    }

    return new ApiResponse({
      message: "Client fetched successfully",
      data: client,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPendingClientRequestsController = async (req, res, next) => {
  try {
    const companyId = req.query.companyId || req.params.companyId;
    const clients = await findClientsRepo({ companyId }, true);

    const pendingClients = clients?.ref?.filter((r) => r.status === "Pending") || [];

    return new ApiResponse({
      message: "Pending clients fetched successfully",
      data: pendingClients,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const clientStatusController = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { status, versionNo } = req.body;
    const userId = req.user?._id;

    if (!status || !["Approved", "Pending", "Rejected"].includes(status)) {
      throw new AppError("Valid status is required (Approved, Pending, Rejected)", 400, "clientStatusController");
    }

    const client = await findClientByIdRepo(clientId, {}, false);

    if (!client) {
      throw new AppError("Client not found", 404, "clientStatusController");
    }

    // Find the version to update
    const versionIndex = client.ref.findIndex((v) => v.versionNo === versionNo);

    if (versionIndex === -1) {
      throw new AppError("Version not found", 404, "clientStatusController");
    }

    // Update the version status
    client.ref[versionIndex].status = status;
    client.ref[versionIndex].statusDate = new Date();
    client.ref[versionIndex].changedBy = userId;

    await client.save({ validateBeforeSave: false });

    await createAuditLog({
      companyId: client.companyId,
      module: "CLIENT",
      entityId: client._id,
      actionType: "CLIENT_STATUS_UPDATED",
      logs: [
        {
          field: "status",
          oldValue: "Pending",
          newValue: status,
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Client status updated successfully",
      data: client,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const updateClientController = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = req.body;
    const userId = req.user?._id;

    const oldClient = await findClientByIdRepo(clientId, {}, false);

    if (!oldClient) {
      throw new AppError("Client not found", 404, "updateClientController");
    }

    const updatedClient = await updateClientRepo(clientId, { ...data, updatedBy: userId }, false);

    await createAuditLog({
      companyId: oldClient.companyId,
      module: "CLIENT",
      entityId: updatedClient._id,
      actionType: "CLIENT_UPDATED",
      logs: [
        {
          field: "client",
          oldValue: { clientName: oldClient.clientName },
          newValue: { clientName: updatedClient.clientName },
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Client updated successfully",
      data: updatedClient,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteClientController = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const userId = req.user?._id;

    const client = await findClientByIdRepo(clientId, {}, false);

    if (!client) {
      throw new AppError("Client not found", 404, "deleteClientController");
    }

    await deleteClientRepo(clientId);

    await createAuditLog({
      companyId: client.companyId,
      module: "CLIENT",
      entityId: clientId,
      actionType: "CLIENT_DELETED",
      logs: [
        {
          field: "client",
          oldValue: { clientName: client.clientName },
          newValue: null,
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Client deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getClientsPaginatedController = async (req, res, next) => {
  try {
    const companyId  = req.query.companyId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getPaginatedClientsRepo({
      companyId,
      page,
      limit,
    });

    return new ApiResponse({
      message: "Clients fetched successfully",
      data: {
        clients: result.clients,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};
