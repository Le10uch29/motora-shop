"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/authUsers";
import { isLocale } from "@/i18n/locales";

export type UpdatePhotoState = { error: string | null };

/** Lets the logged-in customer replace their own photo — relies on the
 * `customer_update_self` / `customer_manage_own_media` RLS policies, since
 * this runs with the customer's own session, not the service-role client. */
export async function updateOwnPhotoAction(
  prevState: UpdatePhotoState,
  formData: FormData
): Promise<UpdatePhotoState> {
  const locale = String(formData.get("locale") ?? "");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "missing_file" };
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "not_authenticated" };

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/photo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("customer-media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("customer-media").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("customers")
    .update({ photo_url: publicUrlData.publicUrl })
    .eq("id", user.id);
  if (updateError) return { error: updateError.message };

  if (isLocale(locale)) revalidatePath(`/${locale}/account`);
  return { error: null };
}
