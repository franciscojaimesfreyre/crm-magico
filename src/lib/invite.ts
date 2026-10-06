import "server-only";
import { db } from "@/lib/db";
import { shortCode } from "@/lib/crypto";

/** Código de invitación al portal, único en todo el sistema. */
export async function uniqueInviteCode() {
  for (;;) {
    const code = shortCode(6);
    if (!(await db.client.findUnique({ where: { inviteCode: code } }))) return code;
  }
}
