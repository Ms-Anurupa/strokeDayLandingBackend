import jwt from "jsonwebtoken";

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is missing from the .env file");
    }

    return secret;
};

export function createAdminToken(admin) {
    return jwt.sign(
        {
            sub: admin.id,
            role: "admin",
        },
        getJwtSecret(),
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        }
    );
}

export function verifyAdminToken(token) {
    return jwt.verify(token, getJwtSecret());
}