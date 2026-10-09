import * as adminService from "../services/adminService.js";

export async function adminLogin(req, res, next) {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await adminService.loginAdmin({ email, password });

        if (!result) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        return res.json({
            success: true,
            message: "Admin login successful",
            ...result,
        });
    } catch (error) {
        next(error);
    }
}

export function getCurrentAdmin(req, res) {
    return res.json({
        success: true,
        admin: req.admin,
    });
}

export async function getDashboard(req, res, next) {
    try {
        const stats = await adminService.getDashboardStats();

        return res.json({
            success: true,
            stats,
        });
    } catch (error) {
        next(error);
    }
}

export async function listRegistrations(req, res, next) {
    try {
        const result = await adminService.listRegistrations(
            req.params.type,
            req.query
        );

        return res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getRegistration(req, res, next) {
    try {
        const item = await adminService.getRegistration(
            req.params.type,
            req.params.id
        );

        return res.json({
            success: true,
            item,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateRegistration(req, res, next) {
    try {
        const item = await adminService.updateRegistration(
            req.params.type,
            req.params.id,
            req.body || {}
        );

        return res.json({
            success: true,
            message: "Registration updated successfully",
            item,
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteRegistration(req, res, next) {
    try {
        await adminService.deleteRegistration(
            req.params.type,
            req.params.id
        );

        return res.json({
            success: true,
            message: "Registration deleted successfully",
        });
    } catch (error) {
        next(error);
    }
}

export async function exportRegistrationList(req, res, next) {
    try {
        const items = await adminService.exportRegistrations(
            req.params.type,
            req.query
        );

        return res.json({
            success: true,
            total: items.length,
            items,
        });
    } catch (error) {
        next(error);
    }
}