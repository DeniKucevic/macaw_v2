// Copy this file to config.h and fill in your values.
// config.h is gitignored — never commit it.

#define WIFI_SSID      "your_wifi_ssid"
#define WIFI_PASSWORD  "your_wifi_password"
#define SERVER_URL     "https://macaw-v2.vercel.app"
#define DEVICE_ID      "your_device_id"
#define DEVICE_SECRET  "your_device_secret"

// Password for wireless (OTA) firmware uploads. The device appears in the
// Arduino IDE under Tools > Port as a network port ("macaw-door"), and the IDE
// asks for this password on upload. Pick something non-trivial: anyone on the
// same network could otherwise reflash the door controller.
#define OTA_PASSWORD   "change_this_ota_password"

// Master cards — scanned UIDs that open the door instantly, no server call.
// Useful for owner/family cards that must always work (even offline).
// Add each UID as a hex string (uppercase, no spaces). End the list with nullptr.
// To get a card's UID: scan it and read the "[RFID] Tag:" line in Serial Monitor.
// Example: #define MASTER_UIDS { "2AD60B05", "AABBCCDD", nullptr }
#define MASTER_UIDS { nullptr }
