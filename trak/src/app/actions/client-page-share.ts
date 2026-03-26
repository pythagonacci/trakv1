"use server";

import { safeRevalidatePath } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClientPageShare } from "@/lib/client-page-shares";

export async function shareClientPageByEmail(
  projectId: string,
  recipientEmail: string
) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }

  const result = await createClientPageShare({
    projectId,
    recipientEmail,
    sharerUserId: authResult.user.id,
  });

  if ("data" in result) {
    await safeRevalidatePath("/dashboard/shared");
  }

  return result;
}
