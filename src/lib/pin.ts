import { db } from "./db";

/**
 * Generate a unique 6-digit PIN for a gym.
 * Stored as plaintext — unique per gym via @@unique([gymId, pin]).
 */
export async function generateUniquePin(gymId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const plain = String(Math.floor(100000 + Math.random() * 900000));

    const collision = await db.user.findFirst({ where: { gymId, pin: plain } });
    if (!collision) return plain;
  }
  throw new Error("Could not generate unique PIN after 20 attempts");
}
