/**
 * PN532 HSU init probe — finds which init your installed library/core responds
 * to, and prints the core version. No WiFi, no relay, no TLS.
 *
 * Newer Arduino-ESP32 cores (3.x) changed HardwareSerial pin handling, which
 * can break a PN532_HSU init that worked on 2.x. This tries four variants and
 * reports the winner (or none), plus the core version so we know the ground.
 *
 *   DIP switches: BOTH OFF (HSU). Wire module SDA->GPIO16, SCL->GPIO17 (crossed),
 *   VCC->3.3V, GND->GND (shared). Serial Monitor: 115200.
 */
#include <Arduino.h>
#include <PN532_HSU.h>
#include <PN532.h>

PN532_HSU pn532hsu(Serial2);
PN532 nfc(pn532hsu);

const char* VARIANT[] = {
  "",
  "V1 Serial2.begin(16,17) then nfc.begin()   [the original]",
  "V2 begin, then RE-APPLY pins after nfc.begin()",
  "V3 nfc.begin() only (pure library default)",
  "V4 swapped pins: Serial2.begin(17,16)"
};

uint32_t tryVariant(int v) {
  switch (v) {
    case 1:
      Serial2.begin(115200, SERIAL_8N1, 16, 17);
      nfc.begin();
      break;
    case 2:
      Serial2.begin(115200, SERIAL_8N1, 16, 17);
      nfc.begin();
      Serial2.begin(115200, SERIAL_8N1, 16, 17);
      break;
    case 3:
      nfc.begin();
      break;
    case 4:
      Serial2.begin(115200, SERIAL_8N1, 17, 16);
      nfc.begin();
      break;
  }
  delay(250);
  return nfc.getFirmwareVersion();
}

int winner = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== PN532 HSU init probe ===");
#ifdef ESP_ARDUINO_VERSION_STR
  Serial.printf("Arduino-ESP32 core: %s\n", ESP_ARDUINO_VERSION_STR);
#else
  Serial.println("Arduino-ESP32 core: older than 2.0 (no version macro)");
#endif
  Serial.printf("free heap: %u\n\n", (unsigned)ESP.getFreeHeap());

  for (int v = 1; v <= 4; v++) {
    Serial.printf("Trying %s ...\n", VARIANT[v]);
    uint32_t ver = tryVariant(v);
    if (ver) {
      Serial.printf("   >>> FOUND! firmware v%d.%d <<<\n",
        (int)((ver >> 16) & 0xFF), (int)((ver >> 8) & 0xFF));
      winner = v;
      break;
    }
    Serial.println("   no response");
    delay(500);
  }

  Serial.println();
  if (winner) {
    Serial.printf("*** WINNER: %s ***\n", VARIANT[winner]);
    nfc.SAMConfig();
    Serial.println("Tap a card...\n");
  } else {
    Serial.println("--- No init worked. Send me the 'core:' line above.");
    Serial.println("    If the core is fine, it's hardware: measure 3.3V at the");
    Serial.println("    module VCC/GND, confirm shared GND, try other wires/module.\n");
  }
}

void loop() {
  if (!winner) { delay(2000); return; }
  uint8_t uid[7], uidLen = 0;
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500) && uidLen > 0) {
    String tag;
    for (uint8_t i = 0; i < uidLen; i++) {
      if (uid[i] < 0x10) tag += "0";
      tag += String(uid[i], HEX);
    }
    tag.toUpperCase();
    Serial.printf("[CARD] %s\n", tag.c_str());
    delay(1500);
  }
}
