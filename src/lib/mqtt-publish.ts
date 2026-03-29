import mqtt from "mqtt";

/**
 * Publishes a door-open command to the device's MQTT topic.
 * Connects, publishes with QoS 1 (guaranteed delivery), then disconnects.
 */
export async function publishDoorOpen(deviceId: string): Promise<void> {
  const host = process.env.MQTT_HOST;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!host || !username || !password) {
    throw new Error("MQTT environment variables not configured");
  }

  const client = await mqtt.connectAsync(`mqtts://${host}:8883`, {
    username,
    password,
    connectTimeout: 5000,
  });

  await client.publishAsync(`macaw/device/${deviceId}/open`, "open", { qos: 1 });
  await client.endAsync();
}
