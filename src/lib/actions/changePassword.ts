"use server";

import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error: string | null; success: boolean };

/** Lets any logged-in user (staff or customer) change their own password. */
export async function changePasswordAction(
  prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const tooShortMessage = String(formData.get("tooShortMessage") ?? "");
  const mismatchMessage = String(formData.get("mismatchMessage") ?? "");
  const wrongCurrentMessage = String(formData.get("wrongCurrentMessage") ?? "");

  if (newPassword.length < 6) {
    return { error: tooShortMessage, success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: mismatchMessage, success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: wrongCurrentMessage, success: false };
  }

  // Re-verifying the current password before allowing a change, rather than
  // trusting the active session alone.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: wrongCurrentMessage, success: false };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message, success: false };
  }

  return { error: null, success: true };
}
