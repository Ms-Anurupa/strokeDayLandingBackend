import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "pg-connection-string";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Check the backend root .env file."
  );
}

const config = parse(connectionString);

if (
  typeof config.password !== "string" ||
  config.password.length === 0
) {
  throw new Error(
    "PostgreSQL password is missing or invalid. Check DATABASE_URL."
  );
}

const pool = new Pool({
  connectionString,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
