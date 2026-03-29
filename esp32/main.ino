/**
 * Macaw ESP32 Firmware
 * Hardware: ESP32-WROOM-32U + Elechouse NFC Module V3 (PN532, HSU mode)
 *
 * Wiring:
 *   NFC TX  → ESP32 GPIO16 (RX2)
 *   NFC RX  → ESP32 GPIO17 (TX2)
 *   NFC VCC → 3.3V
 *   NFC GND → GND
 *   Relay   → GPIO26 (active LOW — most relay modules are active LOW)
 *
 * Elechouse V3 switch positions for HSU mode: SCK=OFF, SDA=OFF (both switches OFF)
 *
 * Required libraries (Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary
 *   - Elechouse PN532 (search "Elechouse NFC")
 *   - ArduinoJson by Benoit Blanchon
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PN532_HSU.h>
#include <PN532.h>
#include "config.h"  // copy config.example.h → config.h and fill in your values

const int MQTT_PORT = 8883;

const int   RELAY_PIN         = 26;
const bool  RELAY_ACTIVE_LOW  = true;
const int   DOOR_OPEN_MS      = 3000;

// ─── NFC ──────────────────────────────────────────────────────────────────────
PN532_HSU pn532hsu(Serial2);
PN532 nfc(pn532hsu);

// ─── MQTT ─────────────────────────────────────────────────────────────────────
WiFiClientSecure wifiSecure;
PubSubClient mqtt(wifiSecure);

char mqttTopic[128];

// ─── Helpers ──────────────────────────────────────────────────────────────────
void openDoor() {
  Serial.println("[DOOR] Opening");
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW : HIGH);
  delay(DOOR_OPEN_MS);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  Serial.println("[DOOR] Closed");
}

// ─── MQTT callback ────────────────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Message on %s\n", topic);
  openDoor();
}

// ─── MQTT connect ─────────────────────────────────────────────────────────────
void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");
    String clientId = "macaw-esp32-" + String(DEVICE_ID).substring(0, 8);
    if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" connected");
      mqtt.subscribe(mqttTopic, 1); // QoS 1
      Serial.printf("[MQTT] Subscribed to %s\n", mqttTopic);
    } else {
      Serial.printf(" failed (state=%d), retry in 5s\n", mqtt.state());
      delay(5000);
    }
  }
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected, IP: %s\n", WiFi.localIP().toString().c_str());
}

// ─── Handle RFID scan ────────────────────────────────────────────────────────
void handleRfidScan(const String& tagId) {
  Serial.printf("[RFID] Tag: %s\n", tagId.c_str());

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/" + DEVICE_ID + "/rfid";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  StaticJsonDocument<256> req;
  req["secret"] = DEVICE_SECRET;
  req["tagId"]  = tagId;
  String body;
  serializeJson(req, body);

  int code = http.POST(body);
  if (code <= 0) {
    Serial.printf("[RFID] HTTP error %d\n", code);
    http.end();
    return;
  }

  String resp = http.getString();
  http.end();

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp)) return;

  bool allowed = doc["data"]["allowed"] | false;
  if (allowed) {
    const char* name = doc["data"]["user"]["name"] | "Unknown";
    Serial.printf("[RFID] ALLOWED: %s\n", name);
    openDoor();
  } else {
    const char* reason = doc["data"]["reason"] | "Denied";
    Serial.printf("[RFID] DENIED: %s\n", reason);
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW); // relay off

  connectWifi();

  // TLS — skip cert verification (HiveMQ uses valid cert, but saves flash space)
  wifiSecure.setInsecure();

  // Build MQTT topic
  snprintf(mqttTopic, sizeof(mqttTopic), "macaw/device/%s/open", DEVICE_ID);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setKeepAlive(30);
  connectMqtt();

  // Init NFC (Serial2: RX=16, TX=17)
  Serial2.begin(115200, SERIAL_8N1, 16, 17);
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println("[NFC] ERROR: PN532 not found. Check wiring and HSU switch positions.");
    while (1) delay(1000);
  }
  Serial.printf("[NFC] Found PN5%02x firmware v%d.%d\n",
    (versiondata >> 24) & 0xFF,
    (versiondata >> 16) & 0xFF,
    (versiondata >>  8) & 0xFF);

  nfc.SAMConfig();
  Serial.println("[BOOT] Macaw ready");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    connectWifi();
  }

  // Keep MQTT alive
  if (!mqtt.connected()) {
    connectMqtt();
  }
  mqtt.loop();

  // Check for NFC card (non-blocking, 50ms timeout)
  uint8_t uid[7];
  uint8_t uidLen = 0;
  bool found = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 50);
  if (found && uidLen > 0) {
    String tagId = "";
    for (uint8_t i = 0; i < uidLen; i++) {
      if (uid[i] < 0x10) tagId += "0";
      tagId += String(uid[i], HEX);
    }
    tagId.toUpperCase();
    handleRfidScan(tagId);
    delay(1500); // debounce
  }
}
