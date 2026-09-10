import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPhoneAliasEmail } from "@/lib/phoneLogin";
import { actionLabel } from "../../logs/labels";
import DetailsToggle, { type LogDetails } from "../../logs/DetailsToggle";
import { orderStatusLabel, orderStatusClass } from "../../orders/statusStyles";
import { getCustomerPurchaseHistory } from "../data";
import CustomerDetailActions from "./CustomerDetailActions";

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
      "id, first_name, last_name, phone, id_card_number, organization_name, address, city, photo_url, created_at"
    )
    .eq("id", id)
    .single();

  if (!row) notFound();

  const { data: userData } = await admin.auth.admin.getUserById(id);

  const purchases = await getCustomerPurchaseHistory(id, locale);

  const { data: entries } = await admin
    .from("logs")
    .select("id, action, entity_type, entity_label, details, created_at")
    .eq("entity_type", "customer")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // A phone-derived stand-in address is an internal login detail, not a
  // contact the customer gave — shown as "—", the same as having none.
  const email = isPhoneAliasEmail(userData.user?.email) ? "" : userData.user?.email ?? "";

  const fields: [string, string][] = [
    [dict.admin.firstNameLabel, row.first_name],
    [dict.admin.lastNameLabel, row.last_name],
    ["Email", email || "—"],
    [dict.admin.phoneLabel, row.phone],
    [dict.admin.idCardLabel, row.id_card_number],
    [dict.admin.organizationNameLabel, row.organization_name],
    [dict.admin.cityLabel, row.city],
    [dict.admin.addressLabel, row.address],
    [dict.admin.tableId, row.id],
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
            address: row.address,
            city: row.city,
            photoUrl: row.photo_url,
          }}
        />
      </div>

      {row.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
      )}

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
        {purchases.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.orderColumnProduct}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.productProductCodeLabel}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.orderColumnQuantity}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.orderColumnStatus}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.orderColumnWhen}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {purchase.productName}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {purchase.productCode || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{purchase.quantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(purchase.status)}`}
                      >
                        {orderStatusLabel(purchase.status, dict.admin)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(purchase.createdAt).toLocaleString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{dict.admin.customerPurchaseHistoryEmpty}</p>
        )}
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
