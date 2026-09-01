const express = require("express");
const router = express.Router();
const requestController = require("../controllers/requestController");
const { auth, isAdmin } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

// إرسال رمز تحقق للبريد قبل إنشاء الطلب
router.post(
  "/send-otp",
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  requestController.sendRequestOTP,
);

// التحقق من رمز البريد قبل إنشاء الطلب
router.post(
  "/verify-otp",
  rateLimit({ max: 20, windowMs: 60 * 60 * 1000 }),
  requestController.verifyRequestOTP,
);

// جلب جميع الطلبات (Admin فقط)
router.get("/", auth, isAdmin, requestController.getAllRequests);

// جلب طلب واحد (Admin فقط)
router.get("/:id", auth, isAdmin, requestController.getRequest);

// تحديث حالة الطلب (Admin فقط)
router.put("/:id/status", auth, isAdmin, requestController.updateRequestStatus);

// إنشاء طلب جديد (عام - من الموقع الرئيسي)
router.post(
  "/",
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  requestController.createRequest,
);

module.exports = router;
