import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLabel } from "./labels";
import ClearLogsButton from "./ClearLogsButton";
import DetailsToggle, { type LogDetails } from "./DetailsToggle";

export default async function LogsPage({
  params,
}: PageProps<"/[locale]/admin/logs">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("logs")
    .select("id, staff_name, action, entity_type, entity_label, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.logsTitle}
        </h1>
        <ClearLogsButton
          locale={locale}
          label={dict.admin.logsClear}
          confirmMessage={dict.admin.confirmClearLogs}
        />
      </div>

      {!entries || entries.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.admin.logsEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.admin.logColumnWho}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.logColumnAction}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.logColumnEntity}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.logColumnWhen}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.staff_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {actionLabel(dict.admin, entry.action)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <div className="flex flex-col gap-1">
                      <span>
                        {entry.entity_type} · {entry.entity_label}
                      </span>
                      <DetailsToggle dict={dict.admin} details={entry.details as LogDetails | null} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(entry.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
