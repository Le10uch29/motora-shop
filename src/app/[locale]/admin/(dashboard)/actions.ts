"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Выход из админки ведёт на общий вход, а не на /admin/login.
 *
 * Админский вход пускает только сотрудников: покупатель, набравший там свои
 * данные, войдёт, но requireStaff тут же вернёт его обратно на ту же форму —
 * со стороны это выглядит как «логин не работает». А вышедший админ по
 * привычке оставался на этом адресе и отдавал его тому, кому нужен обычный
 * аккаунт. Общий вход принимает и сотрудников, и покупателей, и сотруднику
 * после него доступна ссылка в админ-панель.
 */
export async function signOutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
