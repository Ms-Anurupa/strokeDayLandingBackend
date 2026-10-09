import { prisma } from "../config/prisma.js";
import fs from "fs";

function generateRegistrationNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);

  return `GGT26-${timestamp}${random}`;
}

export async function registerParticipant(req, res) {
  try {
    const {
      fullName,
      email,
      phone,
      age,
      gender,
      city,
      talentCategory,
      performanceTitle,
      performanceDuration,
      consent,
    } = req.body;

    // Required fields
    if (!fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    if (!talentCategory) {
      return res.status(400).json({
        success: false,
        message: "Talent category is required.",
      });
    }

    if (consent !== "true" && consent !== true) {
      return res.status(400).json({
        success: false,
        message: "Consent is required.",
      });
    }

    const allowedCategories = [
      "singing",
      "dancing",
      "stand_up_comedy",
    ];

    if (!allowedCategories.includes(talentCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid talent category.",
      });
    }

    // Video required
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Performance video is required.",
      });
    }

    const registrationNumber = generateRegistrationNumber();

    const participant = await prisma.participant.create({
      data: {
        registrationNumber,

        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),

        age: age ? Number(age) : null,
        gender: gender || null,
        city: city || null,

        talentCategory,

        performanceTitle:
          performanceTitle?.trim() || null,

        performanceDuration:
          performanceDuration
            ? Number(performanceDuration)
            : null,

        videoOriginalName: req.file.originalname,
        videoUrl: `/uploads/videos/${req.file.filename}`,
        videoMimeType: req.file.mimetype,
        videoSize: req.file.size,

        consent: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Participant registration completed successfully.",
      data: {
        id: participant.id,
        registrationNumber: participant.registrationNumber,
        fullName: participant.fullName,
        email: participant.email,
        phone: participant.phone,
        talentCategory: participant.talentCategory,
        status: participant.status,
        videoUrl: participant.videoUrl,
        createdAt: participant.createdAt,
      },
    });
  } catch (error) {
    console.error("Participant registration error:", error);

    // Delete uploaded video if DB insert fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(
          "Video cleanup failed:",
          cleanupError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete participant registration.",
    });
  }
}


export const getAllParticipants = async (req, res) => {
  try {
    const participants = await prisma.participant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: participants.length,
      data: participants,
    });
  } catch (error) {
    console.error("Get all participants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch participants",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};