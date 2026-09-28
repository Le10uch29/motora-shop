"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type Picked = { name: string; previewUrl: string | null };

/**
 * A file field that looks like something you can actually drop a file on: a
 * dashed frame, clickable across its whole surface (hence the cursor-pointer),
 * that also accepts a drag-and-drop and then lists what was picked.
 *
 * The real `<input type="file">` stays in the DOM — only visually hidden — so
 * the field keeps its `name` in the surrounding form and server actions read
 * the files exactly as they did from a bare input.
 */
export default function FileDropField({
  id,
  name,
  accept,
  multiple = false,
  hint,
  buttonLabel,
  onSelect,
}: {
  id: string;
  name: string;
  accept: string;
  multiple?: boolean;
  /** One line under the button — what to drop here. */
  hint: string;
  buttonLabel: string;
  /** Called with the input itself after a pick or a drop. It gets the element
   * rather than a change event because a drop isn't one — the callback can
   * still read `.files` and clear `.value` just the same. */
  onSelect?: (input: HTMLInputElement) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Превью живут как blob-ссылки, поэтому их надо отзывать: при новом выборе и
  // при размонтировании, иначе картинки остаются в памяти до перезагрузки.
  const previewUrls = useRef<string[]>([]);
  function revokePreviews() {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current = [];
  }
  useEffect(() => revokePreviews, []);

  function handleSelected(input: HTMLInputElement) {
    revokePreviews();
    setPicked(
      Array.from(input.files ?? []).map((file) => {
        // Превью только для картинок: у таблицы Excel показывать нечего.
        if (!file.type.startsWith("image/")) return { name: file.name, previewUrl: null };
        const url = URL.createObjectURL(file);
        previewUrls.current.push(url);
        return { name: file.name, previewUrl: url };
      })
    );
    onSelect?.(input);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelected(event.target);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const input = inputRef.current;
    const dropped = Array.from(event.dataTransfer.files);
    if (!input || dropped.length === 0) return;
    // Assigning a DataTransfer's FileList is the only way to put dropped files
    // into the input, so a drop submits with the form like a picked file does.
    const transfer = new DataTransfer();
    for (const file of multiple ? dropped : dropped.slice(0, 1)) transfer.items.add(file);
    input.files = transfer.files;
    handleSelected(input);
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragOver
          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
          : "border-zinc-300 bg-zinc-50 hover:border-orange-500 hover:bg-orange-50/50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-zinc-400"
      >
        <path d="M12 16V4M8 8l4-4 4 4" />
        <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <span className="text-sm font-medium text-orange-600">{buttonLabel}</span>
      <span className="text-xs text-zinc-400">{hint}</span>
      {/* Что выбрали: у картинок — сразу превью в рамке 4:3, той же формы, в
          которой фото ляжет в карточку товара, и с object-contain, чтобы
          сходу было видно, если фото не той пропорции. */}
      {picked.some((file) => file.previewUrl) && (
        <div className="flex max-w-full flex-wrap justify-center gap-2 pt-1">
          {picked
            .filter((file) => file.previewUrl)
            .map((file) => (
              <span key={file.previewUrl} className="flex w-24 flex-col items-center gap-1">
                <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.previewUrl!}
                    alt={file.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
                <span className="w-full truncate text-center text-[11px] text-zinc-500">
                  {file.name}
                </span>
              </span>
            ))}
        </div>
      )}

      {picked.length > 0 && !picked.some((file) => file.previewUrl) && (
        <span className="max-w-full truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {picked.map((file) => file.name).join(", ")}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  );
}
