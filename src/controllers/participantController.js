import { prisma } from "../config/prisma.js";

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

    // Basic validation
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
      "SINGING",
      "DANCING",
      "STANDUP_COMEDY",
    ];

    if (!allowedCategories.includes(talentCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid talent category.",
      });
    }

    // Require video
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
      message: "Registration completed successfully.",

      data: {
        id: participant.id,
        registrationNumber: participant.registrationNumber,
        fullName: participant.fullName,
        email: participant.email,
        talentCategory: participant.talentCategory,
        status: participant.status,
        videoUrl: participant.videoUrl,
        createdAt: participant.createdAt,
      },
    });
  } catch (error) {
    console.error("Participant registration error:", error);

    // Remove uploaded file if database insertion fails
    if (req.file) {
      const fs = await import("fs");

      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Ignore cleanup errors
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete registration.",
    });
  }
}