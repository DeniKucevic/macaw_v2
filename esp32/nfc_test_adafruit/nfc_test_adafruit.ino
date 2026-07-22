/**
 * PN532 bring-up — Adafruit_PN532 library over I2C.
 *
 * The well-maintained library (works on Arduino-ESP32 core 3.x, unlike the old
 * Elechouse HSU one). Adafruit supports I2C/SPI, not HSU — so this uses I2C.
 *
 *   1) Library Manager -> install "Adafruit PN532" (by Adafruit).
 *   2) DIP switches: I2C = SET0 ON, SET1 OFF.
 *   3) Wire:  SDA -> GPIO21,  SCL -> GPIO22,  VCC -> 3.3V,  GND -> GND (shared).
 *
 * Serial Monitor: 115200.
 */
#include <Wire.h>
#include <Adafruit_PN532.h>

#define I2C_SDA 21
#define I2C_SCL 22

// IRQ/RESET are not on the module's 4-pin header. In I2C mode the library polls
// the bus for readiness, so these pins aren't actually wired — the constructor
// just needs values.
#define PN532_IRQ   4
#define PN532_RESET 5

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

bool found = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== PN532 Adafruit I2C bring-up ===");
#ifdef ESP_ARDUINO_VERSION_STR
  Serial.printf("Arduino-ESP32 core: %s\n", ESP_ARDUINO_VERSION_STR);
#endif
  Serial.printf("I2C: SDA=%d SCL=%d | free heap: %u\n\n",
    I2C_SDA, I2C_SCL, (unsigned)ESP.getFreeHeap());

  Wire.begin(I2C_SDA, I2C_SCL);
  nfc.begin();

  uint32_t v = nfc.getFirmwareVersion();
  if (!v) {
    Serial.println("PN532 NOT found. Check, in order:");
    Serial.println("  * DIP switches: I2C = SET0 ON, SET1 OFF");
    Serial.println("  * SDA->GPIO21, SCL->GPIO22");
    Serial.println("  * 3.3V measured across the module VCC/GND");
    Serial.println("  * GND shared with the ESP32");
    Serial.println("Fix, then press the ESP32 reset button.");
    return;
  }

  Serial.printf("*** PN532 FOUND — firmware v%d.%d ***\n",
    (int)((v >> 16) & 0xFF), (int)((v >> 8) & 0xFF));
  nfc.SAMConfig();
  found = true;
  Serial.println("Tap a card...\n");
}

void loop() {
  if (!found) { delay(3000); return; }

  uint8_t uid[7];
  uint8_t uidLen = 0;
  // 500ms timeout so the loop stays responsive.
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500)) {
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
