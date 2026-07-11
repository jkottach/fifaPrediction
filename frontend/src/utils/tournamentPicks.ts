export function groupPickResult(
  group: string,
  predicted: string,
  officialGroupChampions: Record<string, string>
): 'correct' | 'wrong' | null {
  const official = officialGroupChampions[group];
  if (!official || !predicted) return null;
  return predicted.toUpperCase() === official.toUpperCase() ? 'correct' : 'wrong';
}

/**
 * Order-independent coloring for a knockout pick (semifinalist / finalist).
 * Mirrors the scoring rule: a team counts if it appears anywhere in the
 * official list. A pick is only marked 'wrong' once the round is fully
 * decided (official list filled to `size`); until then it stays neutral.
 */
export function knockoutPickResult(
  predicted: string,
  official: string[],
  size: number
): 'correct' | 'wrong' | null {
  if (!predicted) return null;
  const filled = official.filter(Boolean).map((t) => t.toUpperCase());
  if (filled.includes(predicted.toUpperCase())) return 'correct';
  if (filled.length >= size) return 'wrong';
  return null;
}

/** Champion is a single exact match; neutral until an official champion is set. */
export function championPickResult(
  predicted: string,
  official: string
): 'correct' | 'wrong' | null {
  if (!predicted || !official) return null;
  return predicted.toUpperCase() === official.toUpperCase() ? 'correct' : 'wrong';
}

export function groupPickBorderClass(result: 'correct' | 'wrong' | null): string {
  if (result === 'correct') {
    return '!border-2 !border-emerald-400 shadow-sm shadow-emerald-500/20';
  }
  if (result === 'wrong') {
    return '!border-2 !border-red-400 shadow-sm shadow-red-500/20';
  }
  return 'border-slate-100 bg-slate-50';
}
