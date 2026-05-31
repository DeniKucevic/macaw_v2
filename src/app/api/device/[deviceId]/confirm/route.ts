/**
 * ESP32 calls this after opening the door to mark the command as executed.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized, notFound } from "@/lib/api-helpers";

const ConfirmSchema = z.object({
  secret:    z.string().min(1),
  commandId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  const command = await db.doorRequest.findUnique({ where: { id: parsed.data.commandId } });
  if (!command || command.deviceId !== deviceId) return notFound("Command");
  if (command.status !== "PENDING") return err("Command already processed", 409);

  await db.doorRequest.update({
    where: { id: command.id },
    data: { status: "EXECUTED", executedAt: new Date() },
  });

  return ok({ confirmed: true });
}
