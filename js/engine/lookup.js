// Shared "find by id" helper. Same result as list.find(x => x.id === id) (undefined when missing).
export const findId = (list, id) => list.find(x => x.id === id);
// Strict variant: throws a clear error on an unknown id (for new code; not swapped into existing calls).
export function needId(list, id, what = "item") {
  const r = findId(list, id);
  if (!r) throw new Error(`Unknown ${what} id: ${id}`);
  return r;
}
