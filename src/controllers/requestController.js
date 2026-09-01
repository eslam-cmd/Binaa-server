const pool = require("../config/database");
const {
  sendEmail,
  getRequestReceivedEmail,
  getRequestStatusEmail,
  getOTPEmailTemplate,
} = require("../lib/email");
const { generateOTP } = require("../lib/crypto");
const { sendTelegramAlert } = require("../lib/telegram");

const requestOTPStore = new Map();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getRequestOTPEntry(email) {
  const normalizedEmail = normalizeEmail(email);
  const entry = requestOTPStore.get(normalizedEmail);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    requestOTPStore.delete(normalizedEmail);
    return null;
  }

  return entry;
}

exports.sendRequestOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "بريد إلكتروني غير صالح" });
    }

    const otpCode = generateOTP();
    requestOTPStore.set(email, {
      code: otpCode,
      verified: false,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    const emailSent = await sendEmail({
      to: email,
      subject: "🔐 رمز التحقق لإرسال الطلب - إسلام هداية",
      html: getOTPEmailTemplate(otpCode, 10),
    });

    if (!emailSent.success) {
      requestOTPStore.delete(email);
      return res
        .status(500)
        .json({ error: "فشل إرسال رمز التحقق، جرب مرة أخرى" });
    }

    res.json({
      success: true,
      message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
    });
  } catch (error) {
    console.error("خطأ في إرسال رمز التحقق للطلب:", error);
    res.status(500).json({ error: "حدث خطأ في إرسال رمز التحقق" });
  }
};

exports.verifyRequestOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res
        .status(400)
        .json({ error: "البريد الإلكتروني ورمز التحقق مطلوبان" });
    }

    const entry = getRequestOTPEntry(email);
    if (!entry) {
      return res.status(401).json({
        error: "انتهت صلاحية رمز التحقق، أعد إرسال الرمز",
      });
    }

    if (entry.code !== otp) {
      entry.attempts += 1;
      if (entry.attempts >= 5) {
        requestOTPStore.delete(email);
      }
      return res.status(401).json({
        error: "رمز التحقق غير صحيح",
        code: "INVALID_OTP",
      });
    }

    entry.verified = true;
    requestOTPStore.set(email, entry);

    res.json({
      success: true,
      message: "تم التحقق من البريد الإلكتروني بنجاح",
    });
  } catch (error) {
    console.error("خطأ في التحقق من رمز الطلب:", error);
    res.status(500).json({ error: "حدث خطأ في التحقق من الرمز" });
  }
};

// جلب جميع الطلبات (Admin فقط)
exports.getAllRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, name, email, project_type, description, status, 
             notes, created_at, updated_at 
      FROM requests
    `;
    const params = [];

    if (status) {
      query += ` WHERE status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // جلب العدد الإجمالي
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM requests" + (status ? " WHERE status = $1" : ""),
      status ? [status] : [],
    );

    res.json({
      success: true,
      requests: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (error) {
    console.error("خطأ في جلب الطلبات:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الطلبات" });
  }
};

// جلب طلب واحد (Admin فقط)
exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, email, project_type, description, status, 
              notes, created_at, updated_at 
       FROM requests 
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error("خطأ في جلب الطلب:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الطلب" });
  }
};

// إنشاء طلب جديد (عام - من الموقع الرئيسي)
exports.createRequest = async (req, res) => {
  try {
    const { name, email, projectType, description, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // التحقق من البيانات
    if (!name || !normalizedEmail || !projectType || !description) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    // التحقق من البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "بريد إلكتروني غير صالح" });
    }

    const otpEntry = getRequestOTPEntry(normalizedEmail);
    if (!otpEntry || !otpEntry.verified) {
      return res.status(401).json({
        error: "يرجى التحقق من البريد الإلكتروني أولاً",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    if (!otp || String(otp).trim() !== String(otpEntry.code)) {
      return res.status(401).json({
        error: "رمز التحقق غير صحيح أو مفقود",
        code: "INVALID_OTP",
      });
    }

    // منع التكرار (طلب مكرر خلال 24 ساعة)
    const existingRequest = await pool.query(
      `SELECT id FROM requests 
       WHERE email = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [normalizedEmail],
    );

    if (existingRequest.rows.length > 0) {
      return res.status(429).json({
        error: "تم إرسال طلب مسبقاً خلال 24 ساعة، يرجى الانتظار",
        code: "DUPLICATE_REQUEST",
      });
    }

    requestOTPStore.delete(normalizedEmail);

    // حفظ الطلب
    const result = await pool.query(
      `INSERT INTO requests (name, email, project_type, description, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [name, normalizedEmail, projectType, description],
    );

    const newRequest = result.rows[0];

    // إرسال إشعار Telegram للمشرف (اختياري - لا يمنع نجاح الطلب)
    try {
      await sendTelegramAlert(
        `📩 **طلب جديد**\n` +
          `👤 الاسم: ${newRequest.name}\n` +
          `📧 البريد: ${newRequest.email}\n` +
          `📂 نوع المشروع: ${newRequest.project_type}\n` +
          `📝 الوصف: ${newRequest.description.substring(0, 200)}${newRequest.description.length > 200 ? "..." : ""}\n` +
          `🆔 رقم الطلب: #${newRequest.id}`,
      );
    } catch (notificationError) {
      console.error("⚠️ فشل إشعار الطلب الجديد:", notificationError);
    }

    // إرسال إيميل تأكيد للعميل (اختياري - لا يمنع نجاح الطلب)
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "✅ تم استلام طلبك - إسلام هداية",
        html: getRequestReceivedEmail(newRequest),
      });
    } catch (notificationError) {
      console.error("⚠️ فشل إرسال إيميل تأكيد الطلب:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "تم إرسال طلبك بنجاح، سنتواصل معك خلال 24 ساعة",
      requestId: newRequest.id,
    });
  } catch (error) {
    console.error("خطأ في إنشاء الطلب:", error);
    res.status(500).json({ error: "حدث خطأ في إنشاء الطلب" });
  }
};

// تحديث حالة الطلب (Admin فقط)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // التحقق من الحالة
    const validStatuses = ["pending", "accepted", "rejected", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة غير صالحة" });
    }

    // التحقق من وجود الطلب
    const existingRequest = await pool.query(
      "SELECT * FROM requests WHERE id = $1",
      [id],
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    // تحديث الحالة
    const result = await pool.query(
      `UPDATE requests 
       SET status = $1, 
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, notes, id],
    );

    const updatedRequest = result.rows[0];

    // إرسال إشعار Telegram
    const statusEmojis = {
      pending: "⏳",
      accepted: "✅",
      rejected: "❌",
      completed: "🎉",
    };

    await sendTelegramAlert(
      `📋 **تحديث حالة الطلب**\n` +
        `🆔 رقم الطلب: #${updatedRequest.id}\n` +
        `👤 العميل: ${updatedRequest.name}\n` +
        `📧 البريد: ${updatedRequest.email}\n` +
        `📊 الحالة: ${statusEmojis[status]} ${status}\n` +
        (notes ? `📝 ملاحظات: ${notes}` : ""),
    ).catch(console.error);

    // إرسال إيميل للعميل
    await sendEmail({
      to: updatedRequest.email,
      subject: `📋 تحديث حالة طلبك #${updatedRequest.id}`,
      html: getRequestStatusEmail(updatedRequest),
    }).catch(console.error);

    // تسجيل النشاط
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "update_request_status",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ requestId: id, status, notes }),
      ],
    );

    res.json({
      success: true,
      message: "تم تحديث حالة الطلب بنجاح",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("خطأ في تحديث حالة الطلب:", error);
    res.status(500).json({ error: "حدث خطأ في تحديث حالة الطلب" });
  }
};

// حذف طلب (Admin فقط)
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM requests WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    // تسجيل النشاط
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "delete_request",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ requestId: id }),
      ],
    );

    res.json({
      success: true,
      message: "تم حذف الطلب بنجاح",
    });
  } catch (error) {
    console.error("خطأ في حذف الطلب:", error);
    res.status(500).json({ error: "حدث خطأ في حذف الطلب" });
  }
};
