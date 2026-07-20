export function storedPageTitle(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function shouldAdoptPreparedPageTitle(
  storedTitle: string | null | undefined,
  preparedTitle: string,
): boolean {
  const prepared = preparedTitle.trim();
  if (!prepared) return false;

  const stored = storedPageTitle(storedTitle);
  return !stored || stored === prepared;
}
