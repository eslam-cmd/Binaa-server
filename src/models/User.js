const pool = require("../config/database");
const bcrypt = require("bcryptjs");

class User {
  static async findByEmail(email) {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      "SELECT id, email, role, is_active, last_login, failed_attempts, locked_until FROM users WHERE id = $1",
      [id],
    );
    return result.rows[0];
  }

  static async createAdminIfNotExists() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const existing = await this.findByEmail(adminEmail);
    if (existing) {
      const isPlaceholderHash =
        !existing.password ||
        existing.password.includes("YourHashedPasswordHere") ||
        !existing.password.startsWith("$2") ||
        existing.password === "admin123";

      const passwordMatches = existing.password
        ? await this.comparePassword(adminPassword, existing.password).catch(
            () => false,
          )
        : false;

      if (isPlaceholderHash || !passwordMatches) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const updated = await pool.query(
          `UPDATE users
           SET password = $1,
               failed_attempts = 0,
               locked_until = NULL,
               role = 'admin'
           WHERE email = $2
           RETURNING id, email, role`,
          [hashedPassword, adminEmail],
        );

        console.log("✅ تم تحديث كلمة مرور Admin من القيم غير الصحيحة");
        return updated.rows[0] || existing;
      }

      console.log("✅ Admin موجود بالفعل");
      return existing;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, role) 
       VALUES ($1, $2, 'admin') 
       RETURNING id, email, role`,
      [adminEmail, hashedPassword],
    );

    console.log("✅ تم إنشاء Admin بنجاح");
    return result.rows[0];
  }

  static async updateFailedAttempts(email, attempts) {
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockMinutes = parseInt(process.env.LOCK_DURATION_MINUTES) || 30;

    const attemptsNum = Number(attempts);
    const maxAttemptsNum = Number(maxAttempts);

    if (attemptsNum >= maxAttemptsNum) {
      await pool.query(
        `UPDATE users 
         SET failed_attempts = $1, 
             locked_until = NOW() + INTERVAL '${lockMinutes} minutes'
         WHERE email = $2`,
        [attemptsNum, email],
      );
    } else {
      await pool.query(
        `UPDATE users 
         SET failed_attempts = $1, 
             locked_until = NULL
         WHERE email = $2`,
        [attemptsNum, email],
      );
    }
  }

  static async resetFailedAttempts(email) {
    await pool.query(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = $1",
      [email],
    );
  }

  static async updateLastLogin(id) {
    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [id],
    );
  }

  static async comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) return false;

    if (
      typeof hashedPassword !== "string" ||
      !hashedPassword.startsWith("$2")
    ) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error("❌ خطأ في مقارنة كلمة المرور:", error.message);
      return false;
    }
  }

  static async isLocked(email) {
    const result = await pool.query(
      "SELECT locked_until FROM users WHERE email = $1",
      [email],
    );

    if (!result.rows[0] || !result.rows[0].locked_until) return false;

    const lockedUntil = new Date(result.rows[0].locked_until);
    return lockedUntil > new Date();
  }

  static async getFailedAttempts(email) {
    const result = await pool.query(
      "SELECT failed_attempts FROM users WHERE email = $1",
      [email],
    );
    return parseInt(result.rows[0]?.failed_attempts) || 0;
  }
}

module.exports = User;
