import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { getOrderDetail } from "../../data";
import { orderStatusLabel, orderStatusClass } from "../../statusStyles";
import { formatGel } from "@/lib/currency";
import OrderDetailActions from "./OrderDetailActions";

export default async function OrderDetailPage({
  params,
}: PageProps<"/[locale]/admin/orders/[customerId]/[orderId]">) {
  const { locale, customerId, orderId } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  const order = await getOrderDetail(orderId, locale);
  if (!order) notFound();

  const productName = order.product?.name ?? order.productNameSnapshot;
  const ordererName = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`
    : order.staffOrderer
      ? `${order.staffOrderer.firstName} ${order.staffOrderer.lastName}`
      : "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-2 py-10">
      <Link
        href={`/${locale}/admin/orders/${customerId}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← {dict.admin.ordererOrdersTitle}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {dict.admin.orderDetailsTitle} №{order.orderNumber}
          </h1>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(order.status)}`}>
            {orderStatusLabel(order.status, dict.admin)}
          </span>
        </div>
        {staff.role === "admin" && (
          <OrderDetailActions
            locale={locale}
            dict={dict.admin}
            id={order.id}
            customerId={customerId}
            label={`${productName} — ${ordererName}`}
            status={order.status}
          />
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {dict.admin.orderProductInfoTitle}
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.orderNumberLabel}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">№{order.orderNumber}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.productsColName}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{productName}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.orderColumnQuantity}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{order.quantity}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.priceAtOrderLabel}</dt>
            <dd className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {formatGel(order.discountedPrice ?? order.priceAtOrder, locale)}
              {order.discountedPrice != null && (
                <span className="text-xs font-normal text-zinc-400 line-through">
                  {formatGel(order.priceAtOrder, locale)}
                </span>
              )}
            </dd>
          </div>
          {order.product && (
            <>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.productBrandLabel}</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {order.product.brandName || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  {dict.admin.productOriginCodeLabel}
                </dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {order.product.originCode || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  {dict.admin.productProductCodeLabel}
                </dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {order.product.productCode || "—"}
                </dd>
              </div>
            </>
          )}
        </dl>

        {order.product ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {dict.admin.orderStockByWarehouseTitle}
            </h3>
            {order.product.stockByWarehouse.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                {order.product.stockByWarehouse.map((row) => (
                  <li key={row.warehouseName} className="flex items-center justify-between">
                    <span>{row.warehouseName}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{dict.admin.warehouseEmptyProducts}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{dict.admin.orderProductDeleted}</p>
        )}
      </section>

      {order.customer && (
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.admin.orderCustomerInfoTitle}
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {(
              [
                [dict.admin.firstNameLabel, order.customer.firstName],
                [dict.admin.lastNameLabel, order.customer.lastName],
                ["Email", order.customer.email],
                [dict.admin.phoneLabel, order.customer.phone],
                [dict.admin.idCardLabel, order.customer.idCardNumber],
                [dict.admin.organizationNameLabel, order.customer.organizationName],
                [dict.admin.cityLabel, order.customer.city],
                [dict.admin.addressLabel, order.customer.address],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {order.staffOrderer && (
        <section className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.admin.orderCustomerInfoTitle}
          </h2>
          <p className="text-sm text-zinc-500">
            {dict.admin.orderStaffOrdererNote} {ordererName}
          </p>
        </section>
      )}
    </main>
  );
}
