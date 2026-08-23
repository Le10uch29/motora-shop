import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  const supabase = createClient(url, key);

  const email = "qa-test-admin@example.com";
  const password = "QaTest-Product-9931!";

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError || !created.user) throw new Error(createError?.message ?? "create failed");

  const { error: profileError } = await supabase.from("staff").insert({
    id: created.user.id, first_name: "QA", last_name: "Test", role: "admin",
  });
  if (profileError) throw new Error(profileError.message);

  console.log("USER_ID:", created.user.id);
  console.log("EMAIL:", email);
  console.log("PASSWORD:", password);
}
main().catch((e) => { console.error(e); process.exit(1); });
