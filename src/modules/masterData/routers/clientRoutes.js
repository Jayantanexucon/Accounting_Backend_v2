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

// POST /api/client/create - Create client
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "CLIENT", action: "CREATE" }),
  createClientController
);

// GET /api/client/paginated - Get paginated clients
router.get(
  "/paginated",
  accessControlMiddleware({ entityKey: "CLIENT", action: "VIEW" }),
  getClientsPaginatedController
);

// GET /api/client/pending/:companyId - Get pending client requests
router.get(
  "/pending/:companyId",
  accessControlMiddleware({ entityKey: "CLIENT", action: "VIEW" }),
  getPendingClientRequestsController
);

// PUT /api/client/status/:clientId - Update client status
router.put(
  "/status/:clientId",
  accessControlMiddleware({ entityKey: "CLIENT", action: "EDIT" }),
  clientStatusController
);

// GET /api/client - Get all clients
router.get(
  "/",
  accessControlMiddleware({ entityKey: "CLIENT", action: "VIEW" }),
  getClientsController
);

// GET /api/client/:id - Get client by ID
router.get(
  "/:id",
  accessControlMiddleware({ entityKey: "CLIENT", action: "VIEW" }),
  getClientByIdController
);

// PUT /api/client/:id - Update client
router.put(
  "/:id",
  accessControlMiddleware({ entityKey: "CLIENT", action: "EDIT" }),
  updateClientController
);

// DELETE /api/client/:id - Delete client
router.delete(
  "/:id",
  accessControlMiddleware({ entityKey: "CLIENT", action: "DELETE" }),
  deleteClientController
);

export default router;
