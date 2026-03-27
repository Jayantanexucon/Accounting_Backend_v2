import { createMenuRepo, findMenuByIdRepo, getAllMenusRepo, updateMenuRepo, deleteMenuRepo, findMenuByKeyRepo } from "../repos/menuRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createMenuController = async (req, res, next) => {
  try {
    const { menuKey, menuName, menuValue, description, category } = req.body;
    const userId = req.user?._id;

    if (!menuKey || !menuName || menuValue === undefined) {
      throw new AppError("Menu key, name, and value are required", 400, "createMenuController");
    }

    const menu = await createMenuRepo({
      menuKey,
      menuName,
      menuValue,
      description,
      category,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: menu._id,
      actionType: "MENU_CREATED",
      logs: [
        {
          field: "menu",
          oldValue: null,
          newValue: { menuKey, menuName },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "Menu created successfully",
        data: menu,
        statusCode: 201,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getAllMenusController = async (req, res, next) => {
  try {
    const { category } = req.query;

    const menus = await getAllMenusRepo(category);

    return res.status(200).json(
      new ApiResponse({
        message: "Menus fetched successfully",
        data: menus,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getMenuByIdController = async (req, res, next) => {
  try {
    const { menuId } = req.params;

    const menu = await findMenuByIdRepo(menuId);
    if (!menu) {
      throw new AppError("Menu not found", 404, "getMenuByIdController");
    }

    return res.status(200).json(
      new ApiResponse({
        message: "Menu fetched successfully",
        data: menu,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateMenuController = async (req, res, next) => {
  try {
    const { menuId } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    const oldMenu = await findMenuByIdRepo(menuId);
    if (!oldMenu) {
      throw new AppError("Menu not found", 404, "updateMenuController");
    }

    const menu = await updateMenuRepo(menuId, {
      ...updateData,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: menu._id,
      actionType: "MENU_UPDATED",
      logs: [
        {
          field: "menu",
          oldValue: { menuName: oldMenu.menuName },
          newValue: { menuName: menu.menuName },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Menu updated successfully",
        data: menu,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteMenuController = async (req, res, next) => {
  try {
    const { menuId } = req.params;
    const userId = req.user?._id;

    const menu = await findMenuByIdRepo(menuId);
    if (!menu) {
      throw new AppError("Menu not found", 404, "deleteMenuController");
    }

    await deleteMenuRepo(menuId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: menuId,
      actionType: "MENU_DELETED",
      logs: [
        {
          field: "menu",
          oldValue: { menuName: menu.menuName },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Menu deleted successfully",
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};
