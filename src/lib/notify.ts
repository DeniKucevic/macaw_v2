/**
 * Sends an operational alert. Prefers a Discord webhook (DISCORD_WEBHOOK_URL),
 * falls back to Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID). If neither is
 * configured it no-ops (the event is still recorded in the audit log), so the
 * app works without any channel set.
 */
export async function notify(message: string): Promise<void> {
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (discord) {
    try {
      await fetch(discord, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    } catch (e) {
      console.error("[notify] discord failed", e);
    }
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
    } catch (e) {
      console.error("[notify] telegram failed", e);
    }
    return;
  }

  console.warn("[notify] no channel configured; message:", message);
}
