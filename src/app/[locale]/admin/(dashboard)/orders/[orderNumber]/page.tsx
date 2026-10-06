import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { getOrderByNumber } from "../data";
import { formatGel } from "@/lib/currency";
import OrderLineRowActions from "./OrderLineRowActions";
import OrderDiscountInput from "./OrderDiscountInput";
import OrderQuantityInput from "./OrderQuantityInput";
import Pagination from "@/components/admin/Pagination";
import { single } from "@/lib/searchParams";
import { ORDER_LINES_PAGE_SIZE } from "../data";
import { productImageUrl } from "@/lib/productImageUrl";

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders/[orderNumber]">) {
  const { locale, orderNumber: orderNumberParam } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  // В адресе может оказаться что угодно — в базу уходит только число.
  const orderNumber = Number(orderNumberParam);
  if (!Number.isInteger(orderNumber)) notFound();

  const result = await getOrderByNumber(orderNumber, locale);
  if (!result) notFound();
  const { orderer, lines, total, createdAt, customerId } = result;

  // Позиций в заказе бывает за сотню — страница с ними всеми и грузится
  // дольше, и читается хуже. Общая сумма считается по всему заказу, а не по
  // показанной странице.
  const sp = await searchParams;
  const page = Math.max(1, Number(single(sp.page)) || 1);
  const pageLines = lines.slice((page - 1) * ORDER_LINES_PAGE_SIZE, page * ORDER_LINES_PAGE_SIZE);

  const ordererName = `${orderer.firstName} ${orderer.lastName}`;

  const profileFields: [string, string][] =
    orderer.kind === "customer"
      ? [
          [dict.admin.organizationNameLabel, orderer.organizationName],
          [dict.admin.idCardLabel, orderer.idCardNumber],
          [dict.admin.cityLabel, orderer.city],
          [dict.admin.addressLabel, orderer.address],
        ]
      : [];

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/${locale}/admin/orders`} className="text-sm text-zinc-500 hover:text-orange-600">
          ← {dict.admin.ordersTitle}
        </Link>
        {orderer.kind === "customer" && (
          <Link
            href={`/${locale}/admin/customers/${customerId}`}
            className="text-sm text-zinc-500 hover:text-orange-600"
          >
            {dict.admin.navCustomers} →
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.orderNumberLabel} №{orderNumber}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date(createdAt).toLocaleString(locale)} · {ordererName}
        </p>
        <p className="text-sm text-zinc-500">
          {orderer.phone || "—"} · {orderer.email || "—"}
        </p>
      </div>

      {profileFields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-2 dark:border-zinc-800">
          {profileFields.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.admin.orderLinesTitle} · {lines.length}
          </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">{dict.admin.productsColProductCode}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnProduct}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnQuantity}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnUnitPrice}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnLineTotal}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnWhen}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.orderColumnStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {pageLines.map((line) => {
                const effectivePrice = line.discountedPrice ?? line.priceAtOrder;
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      {line.productImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={productImageUrl(line.productImage, "thumb")}
                          alt=""
                          className="h-11 w-11 rounded-lg object-fill"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {line.productCode || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{line.productName}</td>
                    <td className="px-4 py-3">
                      <OrderQuantityInput
                        locale={locale}
                        dict={dict.admin}
                        orderId={line.id}
                        orderNumber={orderNumber}
                        label={`${line.productName} — ${ordererName}`}
                        quantity={line.quantity}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <OrderDiscountInput
                        locale={locale}
                        dict={dict.admin}
                        orderId={line.id}
                        orderNumber={orderNumber}
                        label={`${line.productName} — ${ordererName}`}
                        originalPrice={line.priceAtOrder}
                        discountedPrice={line.discountedPrice}
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatGel(effectivePrice * line.quantity, locale)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(line.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderLineRowActions
                        locale={locale}
                        dict={dict.admin}
                        orderNumber={orderNumber}
                        orderId={line.id}
                        label={`${line.productName} — ${ordererName}`}
                        isAdmin={staff.role === "admin"}
                        isCancellable={line.status !== "cancelled"}
                        currentStatus={line.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        basePath={`/${locale}/admin/orders/${orderNumber}`}
        currentPage={page}
        total={lines.length}
        pageSize={ORDER_LINES_PAGE_SIZE}
        searchParams={{}}
      />

      <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="flex items-baseline gap-3 text-lg">
          <span className="text-zinc-600 dark:text-zinc-400">{dict.admin.orderGrandTotalLabel}</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-50">{formatGel(total, locale)}</span>
        </div>
        <Link
          href={`/${locale}/admin/orders/${orderNumber}/invoice`}
          target="_blank"
          className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {dict.admin.printInvoiceButton}
        </Link>
      </div>
    </main>
  );
}
