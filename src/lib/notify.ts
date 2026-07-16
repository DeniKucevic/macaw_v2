/**
 * Sends an operational alert. Currently Telegram (no domain/SMTP setup needed).
 * If TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't configured it no-ops (the event
 * is still recorded in the audit log), so the app works without any channel set.
 */
export async function notify(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[notify] no channel configured; message:", message);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (e) {
    console.error("[notify] failed to send", e);
  }
}
