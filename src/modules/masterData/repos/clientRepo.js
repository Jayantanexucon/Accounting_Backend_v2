import { getClientModel } from "../models/Client.js";
import AppError from "../../../utils/AppError.js";

export const createClientRepo = async (clientData) => {
  try {
    const Client = await getClientModel();
    const client = new Client({
      ...clientData,
      ref: [
        {
          versionNo: 1,
          snapshot: clientData,
          status: "Approved",
        },
      ],
    });
    await client.save();
    return client;
  } catch (error) {
    const statusCode = error.name === "ValidationError" ? 400 : error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createClientRepo");
  }
};

export const findClientRepo = async (filter, lean = true) => {
  try {
    const Client = await getClientModel();
    // Normalize companyId in filter to string
    if (filter.companyId) {
      filter.companyId = String(filter.companyId);
    }
    const query = Client.findOne(filter);
    if (lean) query.lean();
    return await query;
  } catch (error) {
    throw new AppError(error?.message || "Error finding client", 500, "findClientRepo");
  }
};

export const findClientsRepo = async (filter, lean = true) => {
  try {
    const Client = await getClientModel();
    return await Client.find(filter).lean(lean);
  } catch (error) {
    throw new AppError(error?.message || "Error finding clients", 500, "findClientsRepo");
  }
};

export const findClientByIdRepo = async (id, filter = {}, lean = true) => {
  try {
    const Client = await getClientModel();
    const query = Client.findById(id, filter);
    if (lean) query.lean();
    return await query;
  } catch (error) {
    throw new AppError(error?.message || "Error finding client by ID", 500, "findClientByIdRepo");
  }
};

export const updateClientRepo = async (id, updateData, lean = true) => {
  try {
    const Client = await getClientModel();
    const client = await Client.findById(id);
    if (!client) {
      throw new AppError("Client not found", 404, "updateClientRepo");
    }

    const latestVersionNo = client.ref.length > 0 ? client.ref[client.ref.length - 1].versionNo + 1 : 1;
    const mergedSnapshot = { ...client.toObject(), ...updateData };

    const newVersion = {
      versionNo: latestVersionNo,
      snapshot: mergedSnapshot,
      status: "Pending",
    };

    client.ref.push(newVersion);
    Object.assign(client, updateData);

    const saved = await client.save();

    return lean ? saved.toObject() : saved;
  } catch (error) {
    throw new AppError(error?.message || "Error updating client", 500, "updateClientRepo");
  }
};

export const deleteClientRepo = async (id) => {
  try {
    const Client = await getClientModel();
    return await Client.findByIdAndDelete(id);
  } catch (error) {
    throw new AppError(error?.message || "Error deleting client", 500, "deleteClientRepo");
  }
};

export const getLastClientCodeRepo = async (companyId) => {
  try {
    const Client = await getClientModel();
    const lastClient = await Client.findOne({ companyId }, { clientCode: 1 }, { sort: { createdAt: -1 } });
    return lastClient?.clientCode || null;
  } catch (error) {
    throw new AppError(error?.message || "Error getting last client code", 500, "getLastClientCodeRepo");
  }
};

export const getPaginatedClientsRepo = async ({ page, limit, search, status, country }) => {
  try {
    const Client = await getClientModel();
    const skip = (page - 1) * limit;
    // Always return all clients (global master data) - no companyId filter
    const query = {};

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (country && country !== "all") {
      query.clientCountry = country;
    }

    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { clientCode: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
        { panNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await Client.countDocuments(query);

    const clients = await Client.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    return {
      clients,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    throw new AppError(error?.message || "Error getting paginated clients", error?.statusCode || 500, "getPaginatedClientsRepo");
  }
};
