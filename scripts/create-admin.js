const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// استخدم نفس إعدادات السيرفر
const pool = new Pool({
  host: "ep-round-butterfly-aemmbpvt.c-2.us-east-2.aws.neon.tech",
  port: 5432,
  database: "neondb",
  user: "neondb_owner",
  password: "npg_EGAHMw8Ssi4u",
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function createAdmin() {
  try {
    await pool.connect();
    console.log("✅ تم الاتصال بقاعدة البيانات");

    const email = "eslam@gmail.com";
    const password = "eslam000";

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // حذف المستخدم القديم إذا وجد
    await pool.query("DELETE FROM users WHERE email = $1", [email]);

    // إنشاء مستخدم جديد
    const result = await pool.query(
      `INSERT INTO users (email, password, role) 
       VALUES ($1, $2, 'admin') 
       RETURNING id, email, role`,
      [email, hashedPassword],
    );

    console.log("✅ تم إنشاء Admin بنجاح");
    console.log(`   البريد: ${email}`);
    console.log(`   كلمة المرور: ${password}`);
    console.log(`   الدور: ${result.rows[0].role}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error.message);
    process.exit(1);
  }
}

createAdmin();
