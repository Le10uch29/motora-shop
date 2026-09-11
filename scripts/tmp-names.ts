import { createClient } from "@supabase/supabase-js";

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await admin
    .from("products")
    .select("product_code, name, brand_id")
    .limit(8);
  if (error) throw error;
  for (const p of data ?? []) {
    const n = p.name ?? {};
    console.log(
      `${String(p.product_code).padEnd(14)} ru="${n.ru}" az="${n.az}" ka="${n.ka}"  allSame=${n.ru === n.az && n.az === n.ka}`
    );
  }
  const { count } = await admin.from("products").select("*", { count: "exact", head: true });
  console.log("total products:", count);
}
main().catch((e) => { console.error(e); process.exit(1); });
