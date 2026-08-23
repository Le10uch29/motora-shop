export default function AdminSearchBox({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full max-w-xs rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
    />
  );
}
