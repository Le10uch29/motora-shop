"use client";

import { useActionState } from "react";
import { updateOwnPhotoAction, type UpdatePhotoState } from "./actions";
import type { Dictionary } from "@/i18n/dictionary";

const initialState: UpdatePhotoState = { error: null };

export default function PhotoForm({
  locale,
  dict,
  photoUrl,
}: {
  locale: string;
  dict: Dictionary["admin"];
  photoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateOwnPhotoAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
          {dict.noPhoto}
        </div>
      )}
      <input
        name="photo"
        type="file"
        accept="image/*"
        required
        className="text-sm text-zinc-600 dark:text-zinc-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
      >
        {dict.changePhoto}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
