import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { getOrdererOrders } from "../../data";
import { formatGel } from "@/lib/currency";
import PrintButton from "./PrintButton";

const COMPANY_PHONE = "+995 577 46 66 11";

export default async function InvoicePage({
  params,
}: PageProps<"/[locale]/admin/orders/[customerId]/invoice">) {
  const { locale, customerId } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaff(locale);
  const dict = await getDictionary(locale);

  const result = await getOrdererOrders(customerId, locale);
  if (!result) notFound();
  const { orderer, lines, total, warehouseName, warehouseAddress } = result;

  const ordererName = `${orderer.firstName} ${orderer.lastName}`;
  const activeLines = lines.filter((line) => line.status !== "cancelled");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-2 py-10 print:max-w-none print:gap-6 print:px-0 print:py-0">
      <div className="flex items-start justify-between print:hidden">
        <p className="text-sm text-zinc-500">{dict.admin.invoiceTitle}</p>
        <PrintButton label={dict.admin.invoicePrintButton} />
      </div>

      <div className="flex justify-end text-sm text-zinc-500 print:text-black">
        <div className="text-right">
          <p>{dict.admin.invoiceDateLabel}</p>
          <p className="font-medium text-zinc-900 dark:text-zinc-50 print:text-black">
            {new Date().toLocaleDateString(locale)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:border-black sm:grid-cols-2">
        {/* Company info — left side. */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 print:text-black">
            ARAZ MOTORS<span>-2026</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500 print:text-black">{dict.admin.invoiceTitle}</p>
          {(warehouseName || warehouseAddress) && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 print:text-black">
              {dict.admin.warehouseAssignedLabel}: {[warehouseName, warehouseAddress].filter(Boolean).join(", ")}
            </p>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400 print:text-black">
            {dict.admin.companyPhoneLabel}: {COMPANY_PHONE}
          </p>
        </div>

        {/* Customer info — right side. */}
        <div className="flex flex-col gap-1 text-sm sm:items-end sm:text-right print:text-black">
          <p className="font-semibold text-zinc-900 dark:text-zinc-50 print:text-black">{ordererName}</p>
          {orderer.kind === "customer" && (
            <>
              <p className="text-zinc-600 dark:text-zinc-400 print:text-black">{orderer.organizationName}</p>
              <p className="text-zinc-600 dark:text-zinc-400 print:text-black">
                {dict.admin.personalNumberLabel}: {orderer.idCardNumber}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 print:text-black">
                {dict.admin.phoneLabel}: {orderer.phone || "—"}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 print:text-black">
                {[orderer.city, orderer.address].filter(Boolean).join(", ")}
              </p>
            </>
          )}
        </div>
      </div>

      <table className="w-full text-left text-sm print:text-black">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 print:border-black print:text-black">
          <tr>
            <th className="py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 font-medium">{dict.admin.orderNumberLabel}</th>
            <th className="py-2 pr-3 font-medium">{dict.admin.orderColumnProduct}</th>
            <th className="py-2 pr-3 font-medium">{dict.admin.orderColumnQuantity}</th>
            <th className="py-2 pr-3 font-medium">{dict.admin.orderColumnUnitPrice}</th>
            <th className="py-2 text-right font-medium">{dict.admin.orderColumnLineTotal}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 print:divide-zinc-300">
          {activeLines.map((line) => {
            const unitPrice = line.discountedPrice ?? line.priceAtOrder;
            return (
              <tr key={line.id}>
                <td className="py-2 pr-3">
                  {line.productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.productImage}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover print:h-8 print:w-8"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-zinc-100 dark:bg-zinc-800 print:hidden" />
                  )}
                </td>
                <td className="py-2 pr-3 text-zinc-500 print:text-black">№{line.orderNumber}</td>
                <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-50 print:text-black">
                  {line.productName}
                </td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400 print:text-black">{line.quantity}</td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400 print:text-black">
                  {formatGel(unitPrice, locale)}
                </td>
                <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-50 print:text-black">
                  {formatGel(unitPrice * line.quantity, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800 print:border-black">
        <div className="flex items-baseline gap-3 text-lg">
          <span className="text-zinc-600 dark:text-zinc-400 print:text-black">
            {dict.admin.orderGrandTotalLabel}
          </span>
          <span className="font-bold text-zinc-900 dark:text-zinc-50 print:text-black">
            {formatGel(total, locale)}
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 text-sm sm:grid-cols-3 print:text-black">
        <div className="flex flex-col">
          <div className="h-12" />
          <span className="border-t border-zinc-400 pt-2 text-zinc-600 dark:text-zinc-400 print:border-black print:text-black">
            {dict.admin.invoiceCustomerSignatureLabel}
          </span>
        </div>
        <div className="flex flex-col">
          <div className="h-12" />
          <span className="border-t border-zinc-400 pt-2 text-zinc-600 dark:text-zinc-400 print:border-black print:text-black">
            {dict.admin.invoiceSellerSignatureLabel}
          </span>
        </div>
        <div className="flex flex-col">
          <div className="h-12" />
          <span className="border-t border-zinc-400 pt-2 text-zinc-600 dark:text-zinc-400 print:border-black print:text-black">
            {dict.admin.invoiceStampLabel}
          </span>
        </div>
      </div>
    </main>
  );
}
