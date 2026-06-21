export function groupPickResult(
  group: string,
  predicted: string,
  officialGroupChampions: Record<string, string>
): 'correct' | 'wrong' | null {
  const official = officialGroupChampions[group];
  if (!official || !predicted) return null;
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
