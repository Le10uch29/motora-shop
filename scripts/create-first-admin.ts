// Разовый скрипт: создаёт самого первого админа (учётку в Supabase Auth +
// профиль в таблице staff с ролью admin). Нужен один раз для старта —
// дальше новых сотрудников добавляют прямо в самой админке, кнопкой
// "Добавить пользователя".
//
// Запуск:
//   npm run create-admin -- email@example.com пароль Имя Фамилия [телефон] [id_card]

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Не найдены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — проверьте .env.local"
  );
}

const [, , email, password, firstName, lastName, phone, idCardNumber] = process.argv;

if (!email || !password || !firstName || !lastName) {
  console.error(
    "Использование: npm run create-admin -- email пароль Имя Фамилия [телефон] [id_card]"
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey);

async function main() {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Не удалось создать пользователя.");
  }

  const { error: profileError } = await supabase.from("staff").insert({
    id: created.user.id,
    first_name: firstName,
    last_name: lastName,
    phone: phone ?? null,
    id_card_number: idCardNumber ?? null,
    role: "admin",
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  console.log(`Готово: ${email} создан как админ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
