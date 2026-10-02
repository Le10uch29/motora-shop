import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserById } from "@/lib/supabase/authUsers";
import { isPhoneAliasEmail } from "@/lib/phoneLogin";
import { actionLabel } from "../../logs/labels";
import DetailsToggle, { type LogDetails } from "../../logs/DetailsToggle";
import { getCustomerPurchaseOrders } from "../data";
import CustomerDetailActions from "./CustomerDetailActions";
import CustomerPurchases from "./CustomerPurchases";

export default async function CustomerDetailPage({
  params,
}: PageProps<"/[locale]/admin/customers/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("customers")
    .select(
      "id, first_name, last_name, phone, id_card_number, organization_name, organization_id_number, address, city"
    )
    .eq("id", id)
    .single();

  if (!row) notFound();

  const authUser = await getAuthUserById(admin, id);

  const purchases = await getCustomerPurchaseOrders(id, locale);

  const { data: entries } = await admin
    .from("logs")
    .select("id, action, entity_type, entity_label, details, created_at")
    .eq("entity_type", "customer")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // A phone-derived stand-in address is an internal login detail, not a
  // contact the customer gave — shown as "—", the same as having none.
  const email = isPhoneAliasEmail(authUser?.email) ? "" : authUser?.email ?? "";

  // Краткая карточка — только то, по чему покупателя узнают и с чем работают.
  // Остальное (почта, удостоверение, адрес, город, идентификатор) осталось в
  // форме редактирования, где оно и нужно.
  const fields: [string, string][] = [
    [dict.admin.tableName, `${row.first_name} ${row.last_name}`.trim()],
    [dict.admin.phoneLabel, row.phone],
    [dict.admin.organizationIdNumberLabel, row.organization_id_number],
    [dict.admin.organizationNameLabel, row.organization_name],
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-2 py-10">
      <Link href={`/${locale}/admin/customers`} className="text-sm text-zinc-500 hover:text-orange-600">
        ← {dict.admin.customersTitle}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.customerDetailsTitle}
        </h1>
        <CustomerDetailActions
          locale={locale}
          dict={dict.admin}
          values={{
            id: row.id,
            email,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone,
            idCardNumber: row.id_card_number,
            organizationName: row.organization_name,
            organizationIdNumber: row.organization_id_number,
            address: row.address,
            city: row.city,
          }}
        />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-2 dark:border-zinc-800">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {dict.admin.customerPurchaseHistoryTitle}
        </h2>
        <CustomerPurchases locale={locale} dict={dict.admin} orders={purchases} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.admin.historyTitle}</h2>
        {entries && entries.length > 0 ? (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {actionLabel(dict.admin, entry.action)} · {entry.entity_type} · {entry.entity_label}
                  </span>
                  <DetailsToggle dict={dict.admin} details={entry.details as LogDetails | null} />
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(entry.created_at).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{dict.admin.customerHistoryEmpty}</p>
        )}
      </div>
    </main>
  );
}
