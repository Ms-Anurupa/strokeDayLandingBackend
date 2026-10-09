import express from "express";
import { getAllAttendees, registerAttendee } from "../controllers/attendeeController.js";

const router = express.Router();

router.get("/getAllAttendees", getAllAttendees);
router.post("/register", registerAttendee);

export default router;