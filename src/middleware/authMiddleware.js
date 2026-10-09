import { prisma } from "../config/prisma.js";
import { verifyAdminToken } from "../utils/adminToken.js";

export async function requireAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const token = authorization.slice("Bearer ".length);
    const payload = verifyAdminToken(token);

    if (!payload || payload.role !== "admin" || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin token",
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
      },
    });

    if (!admin || !admin.active) {
      return res.status(401).json({
        success: false,
        message: "Admin account is inactive or no longer exists",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your admin session is invalid or expired. Please log in again.",
      });
    }

    next(error);
  }
}