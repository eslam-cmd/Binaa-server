const express = require("express");
const router = express.Router();
const visitorController = require("../controllers/visitorController");
const { auth, isAdmin } = require("../middlewares/auth");
const { rateLimit } = require("../middlewares/rateLimit");

// تسجيل زائر جديد (عام - من العميل)
router.post(
  "/",
  rateLimit({ max: 100, windowMs: 60 * 60 * 1000 }),
  visitorController.trackVisitor,
);

// عرض قائمة الزوار (Admin فقط)
router.get("/", auth, isAdmin, visitorController.getVisitors);

// إحصائيات الزوار (Admin فقط)
router.get("/stats", auth, isAdmin, visitorController.getVisitorStats);

module.exports = router;
