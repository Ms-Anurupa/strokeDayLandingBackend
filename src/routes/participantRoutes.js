import express from "express";
import { handleVideoUpload } from "../middleware/upload.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import {
  getAllParticipants,
  registerParticipant,
} from "../controllers/participantController.js";

const router = express.Router();

// Returns personal data, so admin only.
router.get("/getAllParticipants", requireAdmin, getAllParticipants);

router.post(
  "/participateRegister",
  handleVideoUpload("video"),
  registerParticipant
);

export default router;
