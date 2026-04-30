import { createStateRepo, findStateByIdRepo, getStatesByCountryRepo, getAllStatesRepo, updateStateRepo, deleteStateRepo } from "../repos/stateRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createStateController = async (req, res, next) => {
  try {
    const { stateName, stateCode, country } = req.body;
    const userId = req.user?._id;

    if (!stateName || !stateCode || !country) {
      throw new AppError("State name, code, and country are required", 400, "createStateController");
    }

    const state = await createStateRepo({
      stateName,
      stateCode,
      country,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: state._id,
      actionType: "STATE_CREATED",
      logs: [
        {
          field: "state",
          oldValue: null,
          newValue: { stateName, stateCode },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "State created successfully",
        data: state,
        statusCode: 201,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getStatesByCountryController = async (req, res, next) => {
  try {
    const { countryId } = req.params;

    const states = await getStatesByCountryRepo(countryId);

    return res.status(200).json(
      new ApiResponse({
        message: "States fetched successfully",
        data: states,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getAllStatesController = async (req, res, next) => {
  try {
    const states = await getAllStatesRepo();

    return res.status(200).json(
      new ApiResponse({
        message: "All states fetched successfully",
        data: states,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getStateByIdController = async (req, res, next) => {
  try {
    const { stateId } = req.params;

    const state = await findStateByIdRepo(stateId);
    if (!state) {
      throw new AppError("State not found", 404, "getStateByIdController");
    }

    return res.status(200).json(
      new ApiResponse({
        message: "State fetched successfully",
        data: state,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateStateController = async (req, res, next) => {
  try {
    const { stateId } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    const oldState = await findStateByIdRepo(stateId);
    if (!oldState) {
      throw new AppError("State not found", 404, "updateStateController");
    }

    const state = await updateStateRepo(stateId, {
      ...updateData,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: state._id,
      actionType: "STATE_UPDATED",
      logs: [
        {
          field: "state",
          oldValue: { stateName: oldState.stateName },
          newValue: { stateName: state.stateName },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "State updated successfully",
        data: state,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteStateController = async (req, res, next) => {
  try {
    const { stateId } = req.params;
    const userId = req.user?._id;

    const state = await findStateByIdRepo(stateId);
    if (!state) {
      throw new AppError("State not found", 404, "deleteStateController");
    }

    await deleteStateRepo(stateId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: stateId,
      actionType: "STATE_DELETED",
      logs: [
        {
          field: "state",
          oldValue: { stateName: state.stateName },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "State deleted successfully",
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};
