/**
 * Macaw ESP32 Firmware
 * Hardware: ESP32-WROOM-32U + Elechouse NFC Module V3 (PN532, HSU mode)
 *
 * Wiring:
 *   NFC SDA (TX) → ESP32 GPIO16 (RX2)
 *   NFC SCL (RX) → ESP32 GPIO17 (TX2)
 *   NFC VCC      → 3.3V
 *   NFC GND      → GND
 *   Relay IN     → GPIO4
 *
 * Elechouse V3 switch positions for HSU: SCK=OFF, SDA=OFF (both OFF)
 *
 * Libraries:
 *   - Elechouse PN532 (manual install from GitHub)
 *   - ArduinoJson by Benoit Blanchon
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PN532_HSU.h>
#include <PN532.h>
#include "config.h"

// ─── Constants ────────────────────────────────────────────────────────────────
const int  RELAY_PIN        = 4;
const bool RELAY_ACTIVE_LOW = false;
const int  DOOR_OPEN_MS     = 1000;
const int  POLL_TIMEOUT_MS  = 9000; // server holds 8s, we allow 9s before retry

// ─── NFC ──────────────────────────────────────────────────────────────────────
PN532_HSU pn532hsu(Serial2);
PN532 nfc(pn532hsu);

// ─── Helpers ──────────────────────────────────────────────────────────────────
void openDoor() {
  Serial.println("[DOOR] Opening");
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW : HIGH);
  delay(DOOR_OPEN_MS);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  Serial.println("[DOOR] Closed");
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
  if (resp.isEmpty()) return;

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
  // Wait for WiFi so the PN532 status can be reported to the server.
  while (WiFi.status() != WL_CONNECTED) vTaskDelay(pdMS_TO_TICKS(200));

  Serial2.begin(115200, SERIAL_8N1, 16, 17);
  nfc.begin();

  uint32_t ver = nfc.getFirmwareVersion();
  if (!ver) {
    Serial.println("[NFC] ERROR: PN532 not found!");
    logToServer("ERROR", "PN532 not found (check HSU wiring / DIP switches / power)");
    vTaskDelete(NULL);
    return;
  }
  char verMsg[48];
  snprintf(verMsg, sizeof(verMsg), "PN532 firmware v%d.%d ready",
    (int)((ver >> 16) & 0xFF), (int)((ver >> 8) & 0xFF));
  Serial.printf("[NFC] %s\n", verMsg);
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
  for (;;) {
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

  connectWifi();
  logToServer("INFO", "Device booted");

  xTaskCreatePinnedToCore(nfcTask,  "nfc",  8192, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(pollTask, "poll", 8192, NULL, 1, NULL, 0);

  Serial.println("[BOOT] Macaw ready");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
