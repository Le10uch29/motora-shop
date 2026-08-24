"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionary";

type FieldDiff = { before: string; after: string };
export type LogDetails = Record<string, FieldDiff | true>;

const FIELD_LABEL_KEYS = {
  firstName: "firstNameLabel",
  lastName: "lastNameLabel",
  phone: "phoneLabel",
  idCardNumber: "idCardLabel",
  organizationName: "organizationNameLabel",
  address: "addressLabel",
  postalCode: "postalCodeLabel",
  city: "cityLabel",
  photoUrl: "photoLabel",
  password: "resetPasswordLabel",
  deliveryMethod: "passwordDeliveryLabel",
} as const satisfies Record<string, keyof Dictionary["admin"]>;

function fieldLabel(key: string, dict: Dictionary["admin"]): string {
  const dictKey = FIELD_LABEL_KEYS[key as keyof typeof FIELD_LABEL_KEYS];
  return dictKey ? dict[dictKey] : key;
}

function formatValue(key: string, value: string, dict: Dictionary["admin"]): string {
  if (key === "deliveryMethod") {
    if (value === "phone") return dict.passwordDeliverySms;
    if (value === "email") return dict.passwordDeliveryEmail;
    return dict.passwordDeliveryScreen;
  }
  return value || "—";
}

export default function DetailsToggle({
  dict,
  details,
}: {
  dict: Dictionary["admin"];
  details: LogDetails | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const entries = details ? Object.entries(details) : [];
  if (entries.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-medium text-orange-600 hover:underline"
      >
        {open ? dict.hideDetails : dict.actionDetails}
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
          {entries.map(([key, value]) => (
            <li key={key}>
              {value === true
                ? fieldLabel(key, dict)
                : `${fieldLabel(key, dict)}: ${formatValue(key, value.before, dict)} → ${formatValue(key, value.after, dict)}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
