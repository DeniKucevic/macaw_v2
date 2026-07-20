/**
 * PN532 bring-up test — standalone.
 *
 * Deliberately does NOT use WiFi, TLS, the relay or the server. Those are the
 * things that draw current, allocate memory and can reboot the board, so they
 * hide reader faults. Flash this on a bare ESP32 + PN532 on the bench:
 * if the reader works here, the module and wiring are good.
 *
 * It scans the I2C bus, then tries I2C, then falls back to trying HSU, and
 * tells you which one answered. Once found, tap a card and it prints the UID.
 *
 *   I2C : DIP SET0=ON,  SET1=OFF   SDA→GPIO32, SCL→GPIO33, VCC→3.3V, GND→GND
 *   HSU : DIP SET0=OFF, SET1=OFF   SDA(TX)→GPIO16, SCL(RX)→GPIO17  (crossed!)
 *
 * Serial Monitor: 115200
 */
#include <Arduino.h>
#include <Wire.h>
#include <PN532.h>
#include <PN532_I2C.h>
#include <PN532_HSU.h>

const int I2C_SDA = 32;
const int I2C_SCL = 33;
const int HSU_RX  = 16; // ESP32 RX ← module SDA/TX
const int HSU_TX  = 17; // ESP32 TX → module SCL/RX

PN532_I2C pn532i2c(Wire);
PN532     nfcI2C(pn532i2c);
PN532_HSU pn532hsu(Serial2);
PN532     nfcHSU(pn532hsu);

PN532* nfc = nullptr;   // points at whichever interface answered
const char* mode = "-";

int i2cScan() {
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
  if (!found) Serial.println("[I2C]   nothing on the bus");
  return found;
}

void printVersion(uint32_t v, const char* which) {
  Serial.printf("\n*** PN532 FOUND on %s — firmware v%d.%d ***\n",
    which, (int)((v >> 16) & 0xFF), (int)((v >> 8) & 0xFF));
}

bool tryI2C() {
  Wire.begin(I2C_SDA, I2C_SCL);
  nfcI2C.begin();
  delay(200);
  uint32_t v = nfcI2C.getFirmwareVersion();
  if (!v) return false;
  printVersion(v, "I2C");
  nfc = &nfcI2C; mode = "I2C";
  return true;
}

bool tryHSU() {
  Serial2.begin(115200, SERIAL_8N1, HSU_RX, HSU_TX);
  nfcHSU.begin();
  // PN532_HSU::begin() re-opens Serial2 on default pins — re-apply ours.
  Serial2.begin(115200, SERIAL_8N1, HSU_RX, HSU_TX);
  delay(200);
  uint32_t v = nfcHSU.getFirmwareVersion();
  if (!v) return false;
  printVersion(v, "HSU");
  nfc = &nfcHSU; mode = "HSU";
  return true;
}

void verdict() {
  Serial.println("\n--- NOT FOUND on either interface -------------------------");
  Serial.println("The module never answered, so this is NOT a driver problem.");
  Serial.println("Check in this order:");
  Serial.println("  1) Measure 3.3V between the module's VCC and GND pins.");
  Serial.println("     No voltage = power/wiring, and nothing else matters.");
  Serial.println("  2) GND shared between module and ESP32.");
  Serial.println("  3) DIP switches: I2C = SET0 ON / SET1 OFF.");
  Serial.println("     Only ~3 combinations exist — try them all, it re-tries.");
  Serial.println("  4) Swap the jumper wires. A wire open inside its insulation");
  Serial.println("     looks perfect and is a very common cause.");
  Serial.println("  5) Try the other pin pair (25/26) in case a GPIO is damaged.");
  Serial.println("-----------------------------------------------------------\n");
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n\n=== PN532 bring-up test (no WiFi / no relay) ===");
  Serial.printf("I2C: SDA=%d SCL=%d   |   HSU: RX=%d TX=%d\n",
    I2C_SDA, I2C_SCL, HSU_RX, HSU_TX);
  Serial.printf("free heap: %u\n\n", (unsigned)ESP.getFreeHeap());

  i2cScan();
  if (!tryI2C() && !tryHSU()) {
    verdict();
    return;
  }
  nfc->SAMConfig();
  Serial.println("Ready — tap a card on the reader.\n");
}

void loop() {
  // Not found yet: keep re-probing so you can fix wiring/switches live.
  if (!nfc) {
    delay(5000);
    Serial.println("retrying...");
    i2cScan();
    if (tryI2C() || tryHSU()) {
      nfc->SAMConfig();
      Serial.println("Ready — tap a card on the reader.\n");
    }
    return;
  }

  uint8_t uid[7];
  uint8_t uidLen = 0;
  if (nfc->readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500) && uidLen > 0) {
    String tag;
    for (uint8_t i = 0; i < uidLen; i++) {
      if (uid[i] < 0x10) tag += "0";
      tag += String(uid[i], HEX);
    }
    tag.toUpperCase();
    Serial.printf("[CARD] %s  (%d bytes, via %s)\n", tag.c_str(), uidLen, mode);
    delay(1500);
  }
}
