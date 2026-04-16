import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createClientController,
  getClientsController,
  getClientByIdController,
  getPendingClientRequestsController,
  clientStatusController,
  updateClientController,
  deleteClientController,
  getClientsPaginatedController,
} from "../controllers/clientController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/client/create/:companyId - Create client
router.post(
  "/create/:companyId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "CREATE" }),
  createClientController
);

// GET /api/client/paginated - Get paginated clients
router.get(
  "/paginated",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "VIEW" }),
  getClientsPaginatedController
);

// GET /api/client/pending/:companyId - Get pending client requests
router.get(
  "/pending/:companyId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "VIEW" }),
  getPendingClientRequestsController
);

// PUT /api/client/status/:clientId - Update client status
router.put(
  "/status/:clientId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "EDIT" }),
  clientStatusController
);

// GET /api/client - Get all clients
router.get(
  "/",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "VIEW" }),
  getClientsController
);

// GET /api/client/:id - Get client by ID
router.get(
  "/:clientId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "VIEW" }),
  getClientByIdController
);

// PUT /api/client/:id - Update client
router.put(
  "/:clientId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "EDIT" }),
  updateClientController
);

// DELETE /api/client/:id - Delete client
router.delete(
  "/:clientId",
  accessControlMiddleware({ entityKey: "CLIENTS", action: "DELETE" }),
  deleteClientController
);

export default router;
