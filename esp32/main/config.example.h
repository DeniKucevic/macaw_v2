// Copy this file to config.h and fill in your values.
// config.h is gitignored — never commit it.

#define WIFI_SSID      "Tech_D0017290"
#define WIFI_PASSWORD  "UPYEPHKU"
#define SERVER_URL     "https://macaw-v2.vercel.app"
#define DEVICE_ID      "cmnc7qszj000004jlx3yoz9v0"
#define DEVICE_SECRET  "bf25874051f3bf34d5d88acf6b3b4947fd79f46d8f0129beab107044a82d756e"

// Master cards — scanned UIDs that open the door instantly, no server call.
// Useful for owner/family cards that must always work (even offline).
// Add each UID as a hex string (uppercase, no spaces). End the list with nullptr.
// To get a card's UID: scan it and read the "[RFID] Tag:" line in Serial Monitor.
// Example: #define MASTER_UIDS { "2AD60B05", "AABBCCDD", nullptr }
#define MASTER_UIDS { "FA9D491A", nullptr }
