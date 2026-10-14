import express from "express";
import { getAllAttendees, registerAttendee } from "../controllers/attendeeController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Returns personal data, so admin only.
router.get("/getAllAttendees", requireAdmin, getAllAttendees);
router.post("/register", registerAttendee);

export default router;
