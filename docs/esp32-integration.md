# ESP32 Integration

The ESP32 communicates with GymOS over HTTP. It uses two flows:
1. **RFID scan** — user taps tag → ESP32 asks server → server says allow/deny → ESP32 opens relay
2. **Phone door open** — user taps button in app → server queues command → ESP32 polls and picks it up → opens relay

---

## Setup

### 1. Register the device

Go to **Admin → Devices → Add Device**. Give it a name (e.g. "Main Door").

You'll receive:
- **Device ID** — a unique identifier for this device
- **Secret key** — used to authenticate all requests from this device

> Save both immediately. The secret is shown only once.

### 2. Add RFID tags to members

On a member's detail page, add their RFID tag ID (the UID printed on or read from the card/fob). The format is flexible — whatever your reader outputs (e.g. `"ABCDEF12"` or `"AB:CD:EF:12"`).

### 3. Flash the firmware

Use the constants from step 1 in your sketch:

```cpp
const char* SERVER_URL  = "https://your-domain.com";
const char* DEVICE_ID   = "cmm3zwo790000fes2kuddoix7";  // from admin panel
const char* DEVICE_SECRET = "a3f9...your-secret...b2d1"; // from admin panel
```

---

## Wiring

```
ESP32 GPIO pin → Relay IN
Relay COM       → Door lock power
Relay NO        → Door lock

RFID reader (RC522 or PN532):
  SDA/SS  → GPIO 5
  SCK     → GPIO 18
  MOSI    → GPIO 23
  MISO    → GPIO 19
  RST     → GPIO 22
  3.3V    → 3.3V
  GND     → GND
```

---

## API Flows

### RFID scan

Called when a user scans their tag.

```
POST /api/device/{deviceId}/rfid
Content-Type: application/json

{
  "tagId": "AB:CD:EF:12",
  "secret": "your-device-secret"
}
```

**Response — allowed:**
```json
{
  "allowed": true,
  "user": { "id": "...", "name": "John Doe" },
  "membership": {
    "type": "SESSION_BASED",
    "sessionsLeft": 4,
    "expiresAt": null
  }
}
```

**Response — denied:**
```json
{
  "allowed": false,
  "reason": "Already entered today"
}
```

Possible denial reasons:
- `"No active membership"`
- `"Membership has expired"`
- `"No sessions remaining"`
- `"Already entered today"`
- `"Unknown or inactive tag"`

→ If `allowed: true`, trigger your relay. You do not need to call confirm for RFID — the entry is recorded automatically.

---

### Phone door open — polling

Called every 2–3 seconds to check for pending open commands (from members tapping "Open Door" in the app, or owner tapping the button in admin).

```
POST /api/device/{deviceId}/poll
Content-Type: application/json

{
  "secret": "your-device-secret"
}
```

**Response — no command pending:**
```json
{ "command": null }
```

**Response — command waiting:**
```json
{
  "command": {
    "id": "cmd_abc123",
    "user": { "id": "...", "name": "Ana" },
    "createdAt": "2026-02-27T10:00:00.000Z"
  }
}
```

→ If `command` is not null, open the relay, then call confirm.

Commands expire after **30 seconds**. If the ESP32 doesn't confirm in time, the command is marked expired and the entry is not recorded.

---

### Confirm door opened

Called after the relay fires, to record the entry.

```
POST /api/device/{deviceId}/confirm
Content-Type: application/json

{
  "secret": "your-device-secret",
  "commandId": "cmd_abc123"
}
```

**Response:**
```json
{
  "confirmed": true,
  "entryResult": {
    "allowed": true,
    "membership": { "sessionsLeft": 3, "expiresAt": null }
  }
}
```

---

## Arduino / ESP32 Sketch (example)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// Config
const char* WIFI_SSID    = "your-wifi";
const char* WIFI_PASS    = "your-password";
const char* SERVER_URL   = "https://your-domain.com";
const char* DEVICE_ID    = "your-device-id";
const char* DEVICE_SECRET = "your-device-secret";

// Pins
#define RELAY_PIN 4
#define SS_PIN    5
#define RST_PIN   22

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  SPI.begin();
  rfid.PCD_Init();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void openDoor() {
  digitalWrite(RELAY_PIN, HIGH);
  delay(3000); // hold open 3 seconds
  digitalWrite(RELAY_PIN, LOW);
}

String postJSON(String endpoint, String body) {
  HTTPClient http;
  http.begin(SERVER_URL + endpoint);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  String response = (code > 0) ? http.getString() : "";
  http.end();
  return response;
}

void checkRFID() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Build tag ID from UID bytes
  String tagId = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) tagId += ":";
    tagId += String(rfid.uid.uidByte[i], HEX);
  }
  tagId.toUpperCase();
  rfid.PICC_HaltA();

  Serial.println("Tag scanned: " + tagId);

  // Call the RFID endpoint
  String body = "{\"tagId\":\"" + tagId + "\",\"secret\":\"" + DEVICE_SECRET + "\"}";
  String endpoint = "/api/device/" + String(DEVICE_ID) + "/rfid";
  String response = postJSON(endpoint, body);

  StaticJsonDocument<512> doc;
  deserializeJson(doc, response);

  if (doc["allowed"].as<bool>()) {
    Serial.println("Access granted: " + String(doc["user"]["name"].as<const char*>()));
    openDoor();
  } else {
    Serial.println("Access denied: " + String(doc["reason"].as<const char*>()));
  }
}

void pollForCommands() {
  String body = "{\"secret\":\"" + String(DEVICE_SECRET) + "\"}";
  String endpoint = "/api/device/" + String(DEVICE_ID) + "/poll";
  String response = postJSON(endpoint, body);

  StaticJsonDocument<512> doc;
  deserializeJson(doc, response);

  if (!doc["command"].isNull()) {
    String commandId = doc["command"]["id"].as<String>();
    String userName  = doc["command"]["user"]["name"].as<String>();
    Serial.println("Door requested by: " + userName);

    openDoor();

    // Confirm
    String confirmBody = "{\"secret\":\"" + String(DEVICE_SECRET) + "\",\"commandId\":\"" + commandId + "\"}";
    String confirmEndpoint = "/api/device/" + String(DEVICE_ID) + "/confirm";
    postJSON(confirmEndpoint, confirmBody);
  }
}

unsigned long lastPoll = 0;

void loop() {
  checkRFID();

  // Poll every 2.5 seconds
  if (millis() - lastPoll > 2500) {
    pollForCommands();
    lastPoll = millis();
  }
}
```

---

## Device status

The server updates each device's `lastSeenAt` and `isOnline` flag on every poll or RFID call. You can see this in **Admin → Devices**.

A device shows as **Online** if it has called the server recently. If it goes silent (e.g. power cut, WiFi lost), it will show **Offline** — the `isOnline` flag is set to false on the next server restart or can be updated via a scheduled job.
