
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "StrokeDay Admin";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      active: true,
    },
    create: {
      name,
      email,
      passwordHash,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
    },
  });

  console.log("SUCCESS: Admin account created or updated.");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error("ADMIN SETUP FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });