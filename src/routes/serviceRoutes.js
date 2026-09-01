const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const { auth, isAdmin } = require("../middleware/auth");

// جلب جميع الخدمات (عام)
router.get("/", serviceController.getAllServices);

// إنشاء خدمة جديدة (Admin فقط)
router.post("/", auth, isAdmin, serviceController.createService);

// جلب خدمة واحدة (عام)
router.get("/:id", serviceController.getService);

// تحديث خدمة (Admin فقط)
router.put("/:id", auth, isAdmin, serviceController.updateService);

// حذف خدمة (Admin فقط)
router.delete("/:id", auth, isAdmin, serviceController.deleteService);

module.exports = router;
