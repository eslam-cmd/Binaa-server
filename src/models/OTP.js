const pool = require("../config/database");

class OTP {
  static async create(userId, code, type = "login") {
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + parseInt(process.env.OTP_EXPIRY_MINUTES || 10),
    );

    const result = await pool.query(
      `INSERT INTO otp_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, code, type, expiresAt],
    );
    return result.rows[0];
  }

  static async verify(userId, code, type = "login") {
    // التحقق من وجود الرمز
    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE user_id = $1 AND code = $2 AND type = $3 
       AND is_used = false AND expires_at > NOW()`,
      [userId, code, type],
    );

    if (result.rows.length === 0) {
      // تسجيل محاولة فاشلة
      await pool.query(
        "UPDATE otp_codes SET attempts = attempts + 1 WHERE user_id = $1 AND code = $2 AND type = $3",
        [userId, code, type],
      );
      return null;
    }

    const otp = result.rows[0];

    // إذا تجاوز عدد المحاولات المسموح
    if (otp.attempts >= 3) {
      await pool.query("UPDATE otp_codes SET is_used = true WHERE id = $1", [
        otp.id,
      ]);
      return null;
    }

    // تحديث الحالة
    await pool.query("UPDATE otp_codes SET is_used = true WHERE id = $1", [
      otp.id,
    ]);

    return otp;
  }

  static async cleanupExpired() {
    await pool.query(
      "UPDATE otp_codes SET is_used = true WHERE expires_at < NOW() AND is_used = false",
    );
  }

  static async getRecentAttempts(userId, minutes = 10) {
    const result = await pool.query(
      `SELECT COUNT(*) as attempts 
       FROM otp_codes 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
      [userId],
    );
    return parseInt(result.rows[0].attempts);
  }
}

module.exports = OTP;
