/** PostgREST caps one response at a fixed number of rows (1000 by default),
 * so anything that reads a whole table has to walk it page by page. A catalog
 * of a few hundred products already has more category links than one response
 * can hold. */
const PAGE_SIZE = 1000;

export async function readAllPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await read(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}
