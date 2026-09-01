async function sendTelegramAlert(message) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.warn("⚠️ Telegram غير مضبوط");
      return false;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 **تنبيه أمني**\n\n${message}`,
        parse_mode: "Markdown",
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("❌ خطأ في Telegram:", error);
    return false;
  }
}

module.exports = { sendTelegramAlert };
