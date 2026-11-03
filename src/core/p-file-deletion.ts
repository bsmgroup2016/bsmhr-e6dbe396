/** A failed storage deletion must never clear the employee's reference. */
export async function deletePFileReference(ref: string, remove: (ref: string) => Promise<void>, clear: () => void) {
  await remove(ref);
  clear();
}