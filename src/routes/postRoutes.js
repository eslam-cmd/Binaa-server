const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { auth, isAdmin } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

// جلب جميع المقالات (عام)
router.get("/", rateLimit({ max: 200 }), postController.getAllPosts);

// جلب مقالة واحدة (عام)
router.get("/:id", rateLimit({ max: 200 }), postController.getPost);

// إنشاء مقالة (Admin فقط)
router.post("/", auth, isAdmin, postController.createPost);

// تحديث مقالة (Admin فقط)
router.put("/:id", auth, isAdmin, postController.updatePost);

// حذف مقالة (Admin فقط)
router.delete("/:id", auth, isAdmin, postController.deletePost);

module.exports = router;
