import { createCityRepo, findCityByIdRepo, getCitiesByStateRepo, getAllCitiesRepo, updateCityRepo, deleteCityRepo } from "../repos/cityRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createCityController = async (req, res, next) => {
  try {
    const { cityName, cityCode, state, country, latitude, longitude } = req.body;
    const userId = req.user?._id;

    if (!cityName || !state || !country) {
      throw new AppError("City name, state, and country are required", 400, "createCityController");
    }

    const city = await createCityRepo({
      cityName,
      cityCode,
      state,
      country,
      latitude,
      longitude,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: city._id,
      actionType: "CITY_CREATED",
      logs: [
        {
          field: "city",
          oldValue: null,
          newValue: { cityName, cityCode },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "City created successfully",
        data: city,
        statusCode: 201,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCitiesByStateController = async (req, res, next) => {
  try {
    const { stateId } = req.params;

    const cities = await getCitiesByStateRepo(stateId);

    return res.status(200).json(
      new ApiResponse({
        message: "Cities fetched successfully",
        data: cities,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getAllCitiesController = async (req, res, next) => {
  try {
    const cities = await getAllCitiesRepo();

    return res.status(200).json(
      new ApiResponse({
        message: "All cities fetched successfully",
        data: cities,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCityByIdController = async (req, res, next) => {
  try {
    const { cityId } = req.params;

    const city = await findCityByIdRepo(cityId);
    if (!city) {
      throw new AppError("City not found", 404, "getCityByIdController");
    }

    return res.status(200).json(
      new ApiResponse({
        message: "City fetched successfully",
        data: city,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateCityController = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    const oldCity = await findCityByIdRepo(cityId);
    if (!oldCity) {
      throw new AppError("City not found", 404, "updateCityController");
    }

    const city = await updateCityRepo(cityId, {
      ...updateData,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: city._id,
      actionType: "CITY_UPDATED",
      logs: [
        {
          field: "city",
          oldValue: { cityName: oldCity.cityName },
          newValue: { cityName: city.cityName },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "City updated successfully",
        data: city,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteCityController = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const userId = req.user?._id;

    const city = await findCityByIdRepo(cityId);
    if (!city) {
      throw new AppError("City not found", 404, "deleteCityController");
    }

    await deleteCityRepo(cityId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: cityId,
      actionType: "CITY_DELETED",
      logs: [
        {
          field: "city",
          oldValue: { cityName: city.cityName },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "City deleted successfully",
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};
