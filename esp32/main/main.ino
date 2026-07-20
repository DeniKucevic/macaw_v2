/**
 * Macaw ESP32 Firmware
 * Hardware: ESP32-WROOM-32U + Elechouse NFC Module V3 (PN532)
 *
 * ── PN532 interface: currently I2C ───────────────────────────────────────────
 * The module's 4-pin header (VCC/GND/SDA/SCL) works for BOTH modes — in HSU the
 * SDA pin is the module's TX and SCL is its RX. Switch with NFC_USE_I2C below
 * and set the DIP switches to match. ALWAYS verify against the table printed on
 * the board — if the switches and the code disagree, you get "PN532 not found".
 *
 *   Mode      SET0   SET1     Wiring (module → ESP32)
 *   --------  -----  -----    ------------------------------------------------
 *   I2C  ◄──  ON     OFF      SDA     → GPIO32,        SCL     → GPIO33
 *   HSU/UART  OFF    OFF      SDA(TX) → GPIO16 (RX2),  SCL(RX) → GPIO17 (TX2)
 *
 *   (I2C pins are configurable — see NFC_I2C_SDA_PIN / NFC_I2C_SCL_PIN below.)
 *
 * I2C is preferred here: there is no TX/RX crossing to get wrong (the most
 * common cause of "not found" on HSU), and SDA/SCL match the header labels 1:1.
 *
 *   NFC VCC → 3.3V  (keep 3.3V on I2C — the module's pull-ups tie SDA/SCL to
 *                    VCC, and the ESP32's pins are not 5V tolerant)
 *   NFC GND → GND    (must share ground with the ESP32)
 *   Relay IN → GPIO4
 *
 * Libraries:
 *   - Elechouse PN532 (manual install from GitHub)
 *   - ArduinoJson by Benoit Blanchon
 */

// 1 = I2C (current), 0 = HSU/UART. Change this one line to switch interfaces.
#define NFC_USE_I2C 1

#include <Arduino.h>
#include <esp_system.h>
#include <Preferences.h>
#include <time.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PN532.h>
#if NFC_USE_I2C
  #include <Wire.h>
  #include <PN532_I2C.h>
#else
  #include <PN532_HSU.h>
#endif
#include "config.h"

// ─── Constants ────────────────────────────────────────────────────────────────
const int  RELAY_PIN        = 4;
const bool RELAY_ACTIVE_LOW = false;
const int  DOOR_OPEN_MS     = 1000;
const int  POLL_TIMEOUT_MS  = 9000; // server holds 8s, we allow 9s before retry

// PN532 pins
const int  NFC_UART_RX_PIN  = 16; // ESP32 RX2  ← module SDA/TX
const int  NFC_UART_TX_PIN  = 17; // ESP32 TX2  → module SCL/RX
// I2C can live on almost any GPIO thanks to the ESP32's GPIO matrix — these are
// just the two we picked. Safe alternatives if the board layout suits you better:
// 25/26, 26/27, 13/14, 18/19, 21/22. AVOID: 6-11 (flash), 34-39 (input-only, so
// they can't drive SDA), 0/2/12/15 (boot strapping), 1/3 (USB serial), 4 (relay).
const int  NFC_I2C_SDA_PIN  = 32;
const int  NFC_I2C_SCL_PIN  = 33;

// ─── NFC ──────────────────────────────────────────────────────────────────────
#if NFC_USE_I2C
  PN532_I2C pn532i2c(Wire);
  PN532 nfc(pn532i2c);
#else
  PN532_HSU pn532hsu(Serial2);
  PN532 nfc(pn532hsu);
#endif

// Brings up the bus the PN532 sits on. For HSU the pins are re-applied AFTER
// nfc.begin(), because PN532_HSU::begin() calls Serial2.begin(115200) with the
// default pins and would otherwise clobber our configuration.
void nfcBusBegin() {
#if NFC_USE_I2C
  Wire.begin(NFC_I2C_SDA_PIN, NFC_I2C_SCL_PIN);
  nfc.begin();
#else
  Serial2.begin(115200, SERIAL_8N1, NFC_UART_RX_PIN, NFC_UART_TX_PIN);
  nfc.begin();
  Serial2.begin(115200, SERIAL_8N1, NFC_UART_RX_PIN, NFC_UART_TX_PIN);
#endif
  delay(200); // give the reader a moment to wake before probing
}

#if NFC_USE_I2C
// Diagnostic: lists every device that ACKs on the bus. This separates "the
// wiring/power/DIP switches are wrong" (nothing answers at all) from "the
// module is talking but the driver is unhappy" (0x24 shows up).
void i2cScan() {
  Serial.println("[I2C] scanning bus...");
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C]   device at 0x%02X%s\n",
        addr, addr == 0x24 ? "   <-- PN532" : "");
      found++;
    }
  }
  if (found == 0) {
    Serial.println("[I2C]   NOTHING on the bus.");
    Serial.println("[I2C]   => not a pin/driver problem. Check, in order:");
    Serial.println("[I2C]      1) DIP switches (I2C = SET0 ON, SET1 OFF)");
    Serial.println("[I2C]      2) 3.3V actually present on the module's VCC pin");
    Serial.println("[I2C]      3) GND shared between module and ESP32");
    Serial.println("[I2C]      4) SDA/SCL on the pins the sketch prints above");
  }
}
#endif

// Why did we just boot? A repeating "PANIC"/"BROWNOUT"/watchdog here means the
// board is crash-looping — which looks like a reader fault but isn't one.
const char* resetReasonStr() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:  return "power-on";
    case ESP_RST_EXT:      return "external reset";
    case ESP_RST_SW:       return "software reset";
    case ESP_RST_PANIC:    return "PANIC (crash)";
    case ESP_RST_INT_WDT:  return "interrupt watchdog";
    case ESP_RST_TASK_WDT: return "task watchdog";
    case ESP_RST_WDT:      return "watchdog";
    case ESP_RST_BROWNOUT: return "BROWNOUT (power dip)";
    default:               return "unknown";
  }
}

// Guards the relay: nfcTask (card) and pollTask (app) can both fire a door open
// at the same instant. Without this, whichever finishes first drives the relay
// LOW while the other still thinks the door is open — cutting the open short.
SemaphoreHandle_t doorMutex = NULL;

// ─── Helpers ──────────────────────────────────────────────────────────────────
void openDoor() {
  // Non-blocking: if the door is already opening, this trigger is redundant —
  // the door is open either way, so don't queue a second relay cycle.
  if (doorMutex && xSemaphoreTake(doorMutex, 0) != pdTRUE) {
    Serial.println("[DOOR] Already opening — ignoring duplicate trigger");
    return;
  }
  Serial.println("[DOOR] Opening");
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW : HIGH);
  delay(DOOR_OPEN_MS);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  Serial.println("[DOOR] Closed");
  if (doorMutex) xSemaphoreGive(doorMutex);
}

String postJson(const String& path, const String& body) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(SERVER_URL) + path;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(POLL_TIMEOUT_MS);
  int code = http.POST(body);
  if (code <= 0) {
    Serial.printf("[HTTP] Error %d on %s\n", code, path.c_str());
    http.end();
    return "";
  }
  String resp = http.getString();
  http.end();
  return resp;
}

// Fire-and-forget telemetry to the server: boot/PN532 status, errors, scans.
// Shows up in the app under Uređaji → Dnevnik uređaja; ERROR also hits Discord.
void logToServer(const char* level, const String& message) {
  if (WiFi.status() != WL_CONNECTED) return;
  String path = String("/api/device/") + DEVICE_ID + "/log";
  StaticJsonDocument<256> doc;
  doc["secret"]  = DEVICE_SECRET;
  doc["level"]   = level;   // "INFO" | "ERROR" | "SCAN"
  doc["message"] = message;
  String body;
  serializeJson(doc, body);
  postJson(path, body);
}

// ─── Offline fallback ─────────────────────────────────────────────────────────
// The door must keep working when the network or server is down, WITHOUT
// letting revoked members back in. So we cache the server's allowlist, refuse
// to trust it once it's stale, and queue offline entries for upload later.
Preferences prefs;
const char*   NVS_NS               = "macaw";
const uint32_t ALLOWLIST_REFRESH_MS = 15UL * 60UL * 1000UL; // refresh every 15 min
const uint32_t QUEUE_SYNC_MS        = 30UL * 1000UL;        // retry upload every 30s
const size_t   MAX_QUEUE_CHARS      = 3000;                 // ~200 queued entries

// Epoch seconds, or 0 if the clock was never set (power loss without NTP).
uint32_t nowEpoch() {
  time_t t = time(nullptr);
  return (t > 1600000000) ? (uint32_t)t : 0;
}

void syncClock() {
  configTime(0, 0, "pool.ntp.org", "time.google.com"); // UTC; server expects epoch
  for (int i = 0; i < 20 && nowEpoch() == 0; i++) delay(250);
  Serial.printf("[TIME] epoch=%lu%s\n", (unsigned long)nowEpoch(),
    nowEpoch() ? "" : " (NOT SET — offline entries will be stamped on arrival)");
}

bool allowlistHas(const String& tag) {
  prefs.begin(NVS_NS, true);
  String csv = prefs.getString("allow", "");
  prefs.end();
  if (csv.isEmpty()) return false;
  String hay = "," + csv + ",";
  String needle = "," + tag + ",";
  hay.toUpperCase();
  needle.toUpperCase();
  return hay.indexOf(needle) >= 0;
}

// A cache older than the server's maxStaleHours is refused, so someone revoked
// during a long outage can't keep getting in forever.
bool allowlistFresh() {
  prefs.begin(NVS_NS, true);
  uint32_t at     = prefs.getUInt("allowAt", 0);
  uint32_t staleH = prefs.getUInt("staleH", 24);
  prefs.end();
  uint32_t now = nowEpoch();
  if (!at || !now) return false;
  return (now - at) <= staleH * 3600UL;
}

void refreshAllowlist() {
  String path = String("/api/device/") + DEVICE_ID + "/allowlist";
  StaticJsonDocument<128> req;
  req["secret"] = DEVICE_SECRET;
  String body;
  serializeJson(req, body);
  String resp = postJson(path, body);
  if (resp.isEmpty()) return;

  // Parsed by hand: the list can hold hundreds of UIDs and a JSON document
  // that large is a poor use of heap on this device.
  int s = resp.indexOf("\"tags\":[");
  if (s < 0) return;
  s += 8;
  int e = resp.indexOf(']', s);
  if (e < 0) return;
  String csv = resp.substring(s, e);
  csv.replace("\"", "");
  csv.replace(" ", "");

  uint32_t staleH = 24;
  int m = resp.indexOf("\"maxStaleHours\":");
  if (m >= 0) staleH = (uint32_t)resp.substring(m + 16).toInt();

  prefs.begin(NVS_NS, false);
  prefs.putString("allow", csv);
  prefs.putUInt("allowAt", nowEpoch());
  prefs.putUInt("staleH", staleH ? staleH : 24);
  prefs.end();

  int count = csv.length() ? 1 : 0;
  for (size_t i = 0; i < csv.length(); i++) if (csv[i] == ',') count++;
  Serial.printf("[ALLOW] cached %d cards (stale after %luh)\n",
    count, (unsigned long)staleH);
}

void queueOfflineEntry(const String& tag) {
  prefs.begin(NVS_NS, false);
  String q = prefs.getString("queue", "");
  if (q.length() < MAX_QUEUE_CHARS) {
    q += tag + ":" + String(nowEpoch()) + ";";
    prefs.putString("queue", q);
  } else {
    Serial.println("[OFFLINE] queue full — entry not stored");
  }
  prefs.end();
  Serial.printf("[OFFLINE] queued %s\n", tag.c_str());
}

// Uploads whatever piled up while offline. The queue is only cleared once the
// server confirms, and the endpoint de-duplicates, so a failed upload is safe
// to retry.
void syncOfflineQueue() {
  prefs.begin(NVS_NS, true);
  String q = prefs.getString("queue", "");
  prefs.end();
  if (q.isEmpty()) return;

  String body = String("{\"secret\":\"") + DEVICE_SECRET + "\",\"entries\":[";
  int start = 0, n = 0;
  bool first = true;
  while (start < (int)q.length()) {
    int sep = q.indexOf(';', start);
    if (sep < 0) break;
    String rec = q.substring(start, sep);
    start = sep + 1;
    int c = rec.indexOf(':');
    if (c < 0) continue;
    if (!first) body += ",";
    body += "{\"tagId\":\"" + rec.substring(0, c) + "\",\"at\":" + rec.substring(c + 1) + "}";
    first = false;
    n++;
  }
  body += "]}";
  if (n == 0) return;

  String path = String("/api/device/") + DEVICE_ID + "/sync-entries";
  String resp = postJson(path, body);
  if (resp.isEmpty()) return; // still unreachable — keep the queue for later

  prefs.begin(NVS_NS, false);
  prefs.remove("queue");
  prefs.end();
  Serial.printf("[OFFLINE] synced %d queued entries\n", n);
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────
void scanWifi() {
  Serial.println("[WiFi] Scanning...");
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    Serial.printf("  %ddBm  %s  (%s)\n",
      WiFi.RSSI(i),
      WiFi.SSID(i).c_str(),
      WiFi.encryptionType(i) == WIFI_AUTH_WPA2_ENTERPRISE ? "WPA2-Enterprise" :
      WiFi.encryptionType(i) == WIFI_AUTH_OPEN            ? "Open" : "WPA/WPA2");
  }
  Serial.println("[WiFi] Scan done");
}

void connectWifi() {
  scanWifi();
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected: %s\n", WiFi.localIP().toString().c_str());
}

// ─── Long poll for door commands ─────────────────────────────────────────────
void pollDoorCommands() {
  String path = String("/api/device/") + DEVICE_ID + "/poll";

  StaticJsonDocument<128> req;
  req["secret"] = DEVICE_SECRET;
  String body;
  serializeJson(req, body);

  String resp = postJson(path, body);
  if (resp.isEmpty()) return;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp)) return;

  const char* commandId = doc["command"]["id"];
  if (!commandId) return;

  Serial.printf("[POLL] Command: %s\n", commandId);

  // Confirm
  String confirmPath = String("/api/device/") + DEVICE_ID + "/confirm";
  StaticJsonDocument<256> confirmReq;
  confirmReq["secret"]    = DEVICE_SECRET;
  confirmReq["commandId"] = commandId;
  String confirmBody;
  serializeJson(confirmReq, confirmBody);
  postJson(confirmPath, confirmBody);

  openDoor();
}

// ─── RFID scan ───────────────────────────────────────────────────────────────
void handleRfidScan(const String& tagId) {
  Serial.printf("[RFID] Tag: %s\n", tagId.c_str());

  // Master cards bypass the server entirely — instant open
  static const char* masterUids[] = MASTER_UIDS;
  for (size_t i = 0; masterUids[i] != nullptr; i++) {
    if (tagId.equalsIgnoreCase(masterUids[i])) {
      Serial.println("[RFID] MASTER card — opening");
      openDoor();
      return;
    }
  }

  String path = String("/api/device/") + DEVICE_ID + "/rfid";
  StaticJsonDocument<256> req;
  req["secret"] = DEVICE_SECRET;
  req["tagId"]  = tagId;
  String body;
  serializeJson(req, body);

  String resp = postJson(path, body);
  if (resp.isEmpty()) {
    // Server unreachable — decide locally from the cached allowlist. A stale
    // cache is refused outright so revoked cards can't outlive an outage.
    if (!allowlistFresh()) {
      Serial.println("[RFID] OFFLINE: denied — no fresh allowlist cached");
    } else if (allowlistHas(tagId)) {
      Serial.println("[RFID] OFFLINE: allowed from cache");
      queueOfflineEntry(tagId); // uploaded when the network returns
      openDoor();
    } else {
      Serial.println("[RFID] OFFLINE: denied — card not in cached allowlist");
    }
    return;
  }

  Serial.printf("[RFID] Response: %s\n", resp.c_str());

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp)) return;

  bool allowed = doc["allowed"] | false;
  if (allowed) {
    const char* name = doc["user"]["name"] | "Unknown";
    Serial.printf("[RFID] ALLOWED: %s\n", name);
    openDoor();
  } else {
    const char* reason = doc["reason"] | "Denied";
    Serial.printf("[RFID] DENIED: %s\n", reason);
  }
}

// ─── NFC Task (core 1) ───────────────────────────────────────────────────────
void nfcTask(void* param) {
  // Give WiFi a chance so the reader status can be reported — but don't block
  // forever: the reader (and master cards) must work even with no network.
  for (int i = 0; i < 50 && WiFi.status() != WL_CONNECTED; i++) {
    vTaskDelay(pdMS_TO_TICKS(200));
  }

  // Keep retrying until the reader answers. Never delete the task: that made a
  // boot-time miss permanent until a power cycle, so every wiring/DIP-switch
  // experiment needed a reboot. Now it self-heals within ~5s of being fixed.
  uint32_t ver = 0;
  bool reportedMissing = false;
  int attempt = 0;

  while (!ver) {
    attempt++;
    nfcBusBegin();
    ver = nfc.getFirmwareVersion();
    if (!ver) {
#if NFC_USE_I2C
      Serial.printf("[NFC] attempt %d: PN532 not found (I2C on SDA=%d SCL=%d) | heap %u — retrying in 5s\n",
        attempt, NFC_I2C_SDA_PIN, NFC_I2C_SCL_PIN, (unsigned)ESP.getFreeHeap());
      i2cScan();
#else
      Serial.printf("[NFC] attempt %d: PN532 not found (HSU on RX=%d TX=%d) | heap %u — retrying in 5s\n",
        attempt, NFC_UART_RX_PIN, NFC_UART_TX_PIN, (unsigned)ESP.getFreeHeap());
#endif
      if (!reportedMissing) { // log once, not every retry
        logToServer("ERROR", NFC_USE_I2C
          ? "PN532 not found on I2C (check DIP SET0=ON/SET1=OFF, SDA=21, SCL=22, power)"
          : "PN532 not found on HSU (check DIP both OFF, TX/RX crossed on 16/17, power)");
        reportedMissing = true;
      }
      vTaskDelay(pdMS_TO_TICKS(5000));
    }
  }

  char verMsg[48];
  snprintf(verMsg, sizeof(verMsg), "PN532 firmware v%d.%d ready",
    (int)((ver >> 16) & 0xFF), (int)((ver >> 8) & 0xFF));
  Serial.printf("[NFC] %s (%s)\n", verMsg, NFC_USE_I2C ? "I2C" : "HSU");
  logToServer("INFO", verMsg);
  nfc.SAMConfig();

  // A failed read is indistinguishable from "no card present", so the reader
  // could die mid-run and we'd never notice (the poll task keeps the device
  // "Online"). Actively probe the PN532 on an interval to catch that.
  const uint32_t NFC_HEALTH_MS = 60000; // probe once a minute
  uint32_t lastHealthCheck = millis();
  bool nfcHealthy = true;

  for (;;) {
    uint8_t uid[7];
    uint8_t uidLen = 0;
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500) && uidLen > 0) {
      String tagId = "";
      for (uint8_t i = 0; i < uidLen; i++) {
        if (uid[i] < 0x10) tagId += "0";
        tagId += String(uid[i], HEX);
      }
      tagId.toUpperCase();
      handleRfidScan(tagId);
      vTaskDelay(pdMS_TO_TICKS(2000));
    }

    if (millis() - lastHealthCheck >= NFC_HEALTH_MS) {
      lastHealthCheck = millis();
      bool alive = nfc.getFirmwareVersion() != 0;

      // If it stopped answering, try bringing the bus back up before declaring
      // it dead — a brief glitch shouldn't need a reboot.
      if (!alive) {
        nfcBusBegin();
        alive = nfc.getFirmwareVersion() != 0;
      }

      // Edge-triggered: log only on transitions, so a dead reader alerts once.
      if (!alive && nfcHealthy) {
        nfcHealthy = false;
        Serial.println("[NFC] ERROR: PN532 stopped responding");
        logToServer("ERROR", "PN532 stopped responding (reader disconnected?)");
      } else if (alive && !nfcHealthy) {
        nfcHealthy = true;
        nfc.SAMConfig(); // re-arm the reader after it comes back
        Serial.println("[NFC] PN532 recovered");
        logToServer("INFO", "PN532 recovered");
      }
    }
  }
}

// ─── Poll Task (core 0) ──────────────────────────────────────────────────────
void pollTask(void* param) {
  uint32_t lastAllowlist = 0;
  uint32_t lastQueueSync = 0;

  for (;;) {
    // Keep the offline cache current and flush anything queued during an outage.
    if (WiFi.status() == WL_CONNECTED) {
      if (lastAllowlist == 0 || millis() - lastAllowlist >= ALLOWLIST_REFRESH_MS) {
        refreshAllowlist();
        lastAllowlist = millis();
      }
      if (millis() - lastQueueSync >= QUEUE_SYNC_MS) {
        syncOfflineQueue();
        lastQueueSync = millis();
      }
    }

    if (WiFi.status() != WL_CONNECTED) {
      connectWifi();
    }
    pollDoorCommands(); // blocks up to 5s waiting for command
    vTaskDelay(pdMS_TO_TICKS(2000)); // 2s pause — cuts Vercel usage by ~60%
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);

  Serial.begin(115200);
  delay(500);

  const char* reason = resetReasonStr();
  Serial.printf("\n[BOOT] reset reason: %s | free heap: %u\n",
    reason, (unsigned)ESP.getFreeHeap());

  connectWifi();
  syncClock(); // offline entries need real timestamps, not millis()
  // Surfaces crash-loops in the app/Discord: a stream of "PANIC"/"BROWNOUT"
  // boots is the real fault, even when the symptom looks like a dead reader.
  logToServer("INFO", String("Device booted (reset: ") + reason + ")");
  syncOfflineQueue(); // flush anything from before the reboot
  refreshAllowlist();

  doorMutex = xSemaphoreCreateMutex(); // must exist before the tasks start

  // 12KB stacks: both tasks open TLS connections (HTTPS), and the mbedTLS
  // handshake overflows an 8KB task stack — which shows up as a PANIC reboot.
  xTaskCreatePinnedToCore(nfcTask,  "nfc",  12288, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(pollTask, "poll", 12288, NULL, 1, NULL, 0);

  Serial.println("[BOOT] Macaw ready");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
