import { prisma } from "../config/prisma.js";

export const registerAttendee = async (req, res) => {
  try {
    const { name, email, phone, consent } = req.body ?? {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and phone are required.",
      });
    }

    // Consent is required to proceed
    if (consent !== true) {
      return res.status(400).json({
        success: false,
        message:
          "You must accept the invitation terms to continue.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Check for duplicate email or phone
    const existingAttendee = await prisma.attendee.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { phone: cleanPhone },
        ],
      },
    });

    if (existingAttendee) {
      return res.status(409).json({
        success: false,
        message:
          "An attendee with this email or phone number is already registered.",
      });
    }

    const registrationNumber =
      `ATT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Save only fields defined in the Prisma Attendee model
    const attendee = await prisma.attendee.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        registrationNumber,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Attendee registered successfully.",
      data: attendee,
    });
  } catch (error) {
    console.error("Attendee registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register attendee.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};



export const getAllAttendees = async (req, res) => {
  try {
    const attendees = await prisma.attendee.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: attendees.length,
      data: attendees,
    });
  } catch (error) {
    console.error("Get all attendees error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendees",
      error: error.message,
    });
  }
}