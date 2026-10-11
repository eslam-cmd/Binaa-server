require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");

async function resetPassword() {
  const email = process.env.RESET_PASSWORD_EMAIL?.trim();
  const newPassword = process.env.RESET_PASSWORD;

  if (!email || !newPassword) {
    throw new Error(
      "Set RESET_PASSWORD_EMAIL and RESET_PASSWORD before running this script.",
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const result = await pool.query(
    `UPDATE users
     SET password = $1,
         failed_attempts = 0,
         locked_until = NULL
     WHERE LOWER(email) = LOWER($2)
     RETURNING id, email, role, password`,
    [hashedPassword, email],
  );

  if (result.rows.length === 0) {
    throw new Error("No user exists with the requested email. No account was created.");
  }

  const passwordMatches = await bcrypt.compare(
    newPassword,
    result.rows[0].password,
  );
  if (!passwordMatches) {
    throw new Error("Password hash verification failed.");
  }

  console.info(
    `Password reset and verified for ${result.rows[0].email} (${result.rows[0].role}).`,
  );
}

resetPassword()
  .catch((error) => {
    console.error("Password reset failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
