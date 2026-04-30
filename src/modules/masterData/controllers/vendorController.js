import {
  createVendorRepo,
  findVendorByIdRepo,
  updateVendorRepo,
  deleteVendorRepo,
  completeVendorRepo,
  getPaginatedVendorsRepo,
  searchVendorsRepo,
} from "../repos/vendorRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { normalizeEntityPayload } from "../utils/entityMasterData.js";

// Generate vendorCode
const generateVendorCode = () => {
  return "VEN-" + Math.floor(1000 + Math.random() * 9000);
};

export const addVendorController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const data = await normalizeEntityPayload(req.body, "vendor");
    const files = req.files;
    const userId = req.user?._id;

    if (!data.vendorName) {
      throw new AppError("Vendor name is required", 400, "addVendorController");
    }

    // Generate vendor code automatically
    if (!data.vendorCode) {
      data.vendorCode = generateVendorCode();
    }

    // Auto-set sub-vendor flag
    if (data.parentVendorId) {
      data.isSubVendor = true;
    }

    // If files uploaded, save filenames
    if (files && files.length > 0) {
      data.complianceDocs = files.map((file) => file.filename);
    }

    const vendor = await createVendorRepo({
      companyId,
      ...data,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      companyId,
      module: "VENDOR",
      entityId: vendor._id,
      actionType: "VENDOR_CREATED",
      logs: [
        {
          field: "vendor",
          oldValue: null,
          newValue: { vendorName: vendor.vendorName, vendorCode: vendor.vendorCode },
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Vendor created successfully",
      data: vendor,
      statusCode: 201,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getPaginatedVendorsController = async (req, res, next) => {
  try {
    // Always return all vendors (global master data) - companyId filter removed
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getPaginatedVendorsRepo({
      page,
      limit,
    });

    return new ApiResponse({
      message: "Vendors fetched successfully",
      data: {
        vendors: result.vendors,
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

export const updateVendorController = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const data = await normalizeEntityPayload(req.body, "vendor");
    const files = req.files;
    const userId = req.user?._id;

    const updateData = { ...data };

    // If new files uploaded
    if (files && files.length > 0) {
      updateData.complianceDocs = files.map((file) => file.filename);
    }

    const oldVendor = await findVendorByIdRepo(vendorId);
    if (!oldVendor) {
      throw new AppError("Vendor not found", 404, "updateVendorController");
    }

    const vendor = await updateVendorRepo(vendorId, { ...updateData, updatedBy: userId });

    const auditLogs = [];

    if (oldVendor.vendorName !== vendor.vendorName) {
      auditLogs.push({
        field: "vendorName",
        oldValue: oldVendor.vendorName,
        newValue: vendor.vendorName,
      });
    }

    await createAuditLog({
      companyId: vendor.companyId,
      module: "VENDOR",
      entityId: vendor._id,
      actionType: "VENDOR_UPDATED",
      logs: auditLogs.length > 0 ? auditLogs : [{ field: "vendor", oldValue: oldVendor._id, newValue: vendor._id }],
      userId,
    });

    return new ApiResponse({
      message: "Vendor updated successfully",
      data: vendor,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const deleteVendorController = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user?._id;

    const vendor = await findVendorByIdRepo(vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404, "deleteVendorController");
    }

    await deleteVendorRepo(vendorId);

    await createAuditLog({
      companyId: vendor.companyId,
      module: "VENDOR",
      entityId: vendorId,
      actionType: "VENDOR_DELETED",
      logs: [
        {
          field: "vendor",
          oldValue: { vendorName: vendor.vendorName },
          newValue: null,
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Vendor deleted successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const completeVendorController = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user?._id;

    const vendor = await findVendorByIdRepo(vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404, "completeVendorController");
    }

    const updatedVendor = await completeVendorRepo(vendorId);

    await createAuditLog({
      companyId: vendor.companyId,
      module: "VENDOR",
      entityId: vendorId,
      actionType: "VENDOR_COMPLETED",
      logs: [
        {
          field: "status",
          oldValue: vendor.status,
          newValue: "Completed",
        },
      ],
      userId,
    });

    return new ApiResponse({
      message: "Vendor marked as completed successfully",
      data: updatedVendor,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const getVendorByIdController = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const vendor = await findVendorByIdRepo(vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404, "getVendorByIdController");
    }

    return new ApiResponse({
      message: "Vendor fetched successfully",
      data: vendor,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const searchVendorsController = async (req, res, next) => {
  try {
    // Always search all vendors (global master data) - companyId filter removed
    const { searchTerm } = req.query;
    const filters = {
      status: req.query.status,
      serviceType: req.query.serviceType,
    };

    const vendors = await searchVendorsRepo(searchTerm, filters);

    return new ApiResponse({
      message: "Vendors searched successfully",
      data: vendors,
    }).send(res);
  } catch (error) {
    next(error);
  }
};
