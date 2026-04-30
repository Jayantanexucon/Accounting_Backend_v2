import {
  createHSNRepo,
  findHSNByIdRepo,
  getAllHSNRepo,
  updateHSNRepo,
  deleteHSNRepo,
  createManyHSNRepo,
} from "../repos/hsnRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createHSNController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const data = req.body;
    const userId = req.user?._id;

    if (!companyId) {
      throw new AppError("Company ID is required", 400, "createHSNController");
    }

    const hsn = await createHSNRepo({
      companyId,
      ...data,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      companyId,
      module: "HSN",
      entityId: hsn._id,
      actionType: "HSN_CREATED",
      logs: [
        {
          field: "hsn",
          oldValue: null,
          newValue: {
            hsnCode: hsn.hsnCode,
            serviceType: hsn.serviceType,
            igst: hsn.igst,
            cgst: hsn.cgst,
            sgst: hsn.sgst,
          },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        success: true,
        data: hsn,
        message: "HSN created successfully",
        statusCode: 201,
      })
    );
  } catch (err) {
    next(err);
  }
};

export const getAllHSNController = async (req, res, next) => {
  try {
    // Always return all HSN codes (global master data) - companyId filter removed
    const list = await getAllHSNRepo();

    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: list,
        message: "HSN list fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const getHSNController = async (req, res, next) => {
  try {
    const { hsnId } = req.params;

    // Search all HSN codes (global master data) - no companyId filter
    const hsn = await findHSNByIdRepo(hsnId);

    if (!hsn) {
      throw new AppError("HSN not found", 404, "getHSNController");
    }

    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: hsn,
        message: "HSN fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const updateHSNController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const hsnId = req.params.hsnId || req.params.id;
    const data = req.body;
    const userId = req.user?._id;

    const oldHSN = await findHSNByIdRepo(hsnId, companyId);
    if (!oldHSN) {
      throw new AppError("HSN not found", 404, "updateHSNController");
    }

    const updated = await updateHSNRepo(hsnId, { ...data, updatedBy: userId });

    await createAuditLog({
      companyId,
      module: "HSN",
      entityId: updated._id,
      actionType: "HSN_UPDATED",
      logs: [
        {
          field: "hsn",
          oldValue: {
            hsnCode: oldHSN.hsnCode,
            serviceType: oldHSN.serviceType,
            igst: oldHSN.igst,
            cgst: oldHSN.cgst,
            sgst: oldHSN.sgst,
          },
          newValue: {
            hsnCode: updated.hsnCode,
            serviceType: updated.serviceType,
            igst: updated.igst,
            cgst: updated.cgst,
            sgst: updated.sgst,
          },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: updated,
        message: "HSN updated successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const deleteHSNController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const hsnId = req.params.hsnId || req.params.id;
    const userId = req.user?._id;

    const hsn = await findHSNByIdRepo(hsnId, companyId);
    if (!hsn) {
      throw new AppError("HSN not found", 404, "deleteHSNController");
    }

    await deleteHSNRepo(hsnId);

    await createAuditLog({
      companyId,
      module: "HSN",
      entityId: hsnId,
      actionType: "HSN_DELETED",
      logs: [
        {
          field: "hsn",
          oldValue: {
            hsnCode: hsn.hsnCode,
            serviceType: hsn.serviceType,
          },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        success: true,
        message: "HSN deleted successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

export const bulkCreateHSNController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const userId = req.user?._id;
    const hsnList = req.body;

    if (!companyId) {
      throw new AppError("Company ID is required", 400, "bulkCreateHSNController");
    }

    if (!Array.isArray(hsnList) || hsnList.length === 0) {
      throw new AppError("HSN list must be a non-empty array", 400, "bulkCreateHSNController");
    }

    // Attach companyId to each record
    const dataWithCompanyId = hsnList.map((hsn) => ({
      ...hsn,
      companyId,
      createdBy: userId,
      updatedBy: userId,
    }));

    const createdHSNs = await createManyHSNRepo(dataWithCompanyId);

    await createAuditLog({
      companyId,
      module: "HSN",
      entityId: null,
      actionType: "HSN_BULK_CREATED",
      logs: [
        {
          field: "count",
          oldValue: null,
          newValue: createdHSNs.length,
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        success: true,
        data: createdHSNs,
        message: `${createdHSNs.length} HSN records created successfully`,
        statusCode: 201,
      })
    );
  } catch (err) {
    next(err);
  }
};
