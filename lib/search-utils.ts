type SearchValue = SearchValue[] | boolean | number | string | null | undefined;

export function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

export function matchesSearchQuery(query: string, values: SearchValue[]) {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = flattenSearchValues(values).join(' ').toLowerCase();
  return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
}

function flattenSearchValues(values: SearchValue[]): string[] {
  return values.flatMap((value): string[] => {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      return flattenSearchValues(value);
    }

    return [String(value)];
  });
}
