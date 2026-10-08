import { prisma } from "../config/prisma.js";

export const registerAttendee = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      consent,
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and phone are required",
      });
    }

    if (consent !== true) {
      return res.status(400).json({
        success: false,
        message:
          "You must accept the invitation terms to continue.",
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email)
      .trim()
      .toLowerCase();
    const cleanPhone = String(phone).trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const existingAttendee =
      await prisma.attendee.findFirst({
        where: {
          OR: [
            {
              email: cleanEmail,
            },
            {
              phone: cleanPhone,
            },
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
      `ATT-${Date.now()}`;

    const attendee =
      await prisma.attendee.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          consent: true,
          registrationNumber,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Attendee registered successfully",
      data: attendee,
    });
  } catch (error) {
    console.error(
      "Attendee registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to register attendee",
      error: error.message,
    });
  }
};