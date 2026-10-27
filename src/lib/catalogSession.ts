import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/supabase/authUsers";

/**
 * Вошёл ли пользователь, от имени которого рендерится страница.
 *
 * Каталог закрыт: RLS отдаёт товары, бренды и категории только вошедшим
 * (сотруднику или покупателю). Обычные запросы каталога идут сессией
 * пользователя и получают это правило от самой базы. Но два тяжёлых запроса
 * кэшируются между запросами (unstable_cache — дерево категорий и марки с
 * моделями для фильтра в шапке), а внутри такого кэша Next не даёт читать
 * cookies. Они читают базу серверным ключом, и эта проверка стоит перед ними:
 * гость получает пустой ответ ещё до кэша.
 *
 * Обёрнуто в cache(): за один рендер сессия проверяется один раз.
 */
export const hasCatalogSession = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  return Boolean(await getAuthIdentity(supabase));
});
