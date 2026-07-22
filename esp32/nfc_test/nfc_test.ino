/**
 * PN532 bring-up test — HSU, minimal.
 *
 * This reproduces EXACTLY the reader init from the last firmware that worked
 * (commit 16ee7e7): PN532_HSU on Serial2, pins 16/17, nothing added. No WiFi,
 * no relay, no I2C. If this finds the reader, the module + wiring are fine and
 * the fault was in later firmware changes.
 *
 *   DIP switches: HSU/UART = SET0 OFF, SET1 OFF  (both OFF)
 *   Wiring (module → ESP32):
 *     SDA (module TX) → GPIO16  (ESP32 RX2)
 *     SCL (module RX) → GPIO17  (ESP32 TX2)   <-- crossed: module TX→ESP RX
 *     VCC → 3.3V     GND → GND (shared with the ESP32)
 *
 * Serial Monitor: 115200
 */
#include <Arduino.h>
#include <PN532_HSU.h>
#include <PN532.h>

PN532_HSU pn532hsu(Serial2);
PN532 nfc(pn532hsu);

bool found = false;

bool probe() {
  // Exactly as the working firmware did it — set the pins, begin, then ask.
  Serial2.begin(115200, SERIAL_8N1, 16, 17);
  nfc.begin();
  uint32_t v = nfc.getFirmwareVersion();
  if (!v) return false;
  Serial.printf("\n*** PN532 FOUND — firmware v%d.%d ***\n",
    (int)((v >> 16) & 0xFF), (int)((v >> 8) & 0xFF));
  nfc.SAMConfig();
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n\n=== PN532 HSU bring-up (matches the known-good init) ===");
  Serial.println("DIP: BOTH OFF | wire module SDA->GPIO16, SCL->GPIO17 (crossed)");
  Serial.printf("free heap: %u\n\n", (unsigned)ESP.getFreeHeap());

  found = probe();
  if (found) {
    Serial.println("Ready — tap a card.\n");
  } else {
    Serial.println("Not found yet — will retry every 3s.");
    Serial.println("Fix live (no reflash needed):");
    Serial.println("  * DIP switches BOTH OFF (this is HSU mode)");
    Serial.println("  * measure 3.3V across the module's VCC/GND");
    Serial.println("  * GND shared with the ESP32");
    Serial.println("  * SDA->16 and SCL->17 (try swapping these two once)");
    Serial.println();
  }
}

void loop() {
  if (!found) {
    delay(3000);
    Serial.println("retrying HSU...");
    if (probe()) { found = true; Serial.println("Ready — tap a card.\n"); }
    return;
  }

  uint8_t uid[7];
  uint8_t uidLen = 0;
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500) && uidLen > 0) {
    String tag;
    for (uint8_t i = 0; i < uidLen; i++) {
      if (uid[i] < 0x10) tag += "0";
      tag += String(uid[i], HEX);
    }
    tag.toUpperCase();
    Serial.printf("[CARD] %s  (%d bytes)\n", tag.c_str(), uidLen);
    delay(1500);
  }
}
