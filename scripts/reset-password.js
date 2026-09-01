const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  host: "ep-round-butterfly-aemmbpvt.c-2.us-east-2.aws.neon.tech",
  port: 5432,
  database: "neondb",
  user: "neondb_owner",
  password: "npg_EGAHMw8Ssi4u",
  ssl: {
    rejectUnauthorized: false,
  },
});

async function forceReset() {
  try {
    await pool.connect();
    console.log("✅ تم الاتصال بقاعدة البيانات");

    const email = "eslam@gmail.com";
    const newPassword = "eslam000";

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // تحديث كلمة المرور
    const result = await pool.query(
      `UPDATE users 
       SET password = $1, 
           failed_attempts = 0, 
           locked_until = NULL 
       WHERE email = $2 
       RETURNING id, email, role`,
      [hashedPassword, email],
    );

    if (result.rows.length > 0) {
      console.log("✅ تم تحديث كلمة المرور بنجاح");
      console.log(`   البريد: ${email}`);
      console.log(`   كلمة المرور الجديدة: ${newPassword}`);

      // التحقق من التشفير
      const check = await bcrypt.compare(newPassword, result.rows[0].password);
      console.log(`   التحقق: ${check ? "✅ صحيح" : "❌ خطأ"}`);
    } else {
      console.log("❌ المستخدم غير موجود، جاري إنشائه...");

      const hashedPassword2 = await bcrypt.hash(newPassword, 10);
      await pool.query(
        `INSERT INTO users (email, password, role) 
         VALUES ($1, $2, 'admin')`,
        [email, hashedPassword2],
      );
      console.log("✅ تم إنشاء مستخدم جديد");
      console.log(`   البريد: ${email}`);
      console.log(`   كلمة المرور: ${newPassword}`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error.message);
    process.exit(1);
  }
}

forceReset();
