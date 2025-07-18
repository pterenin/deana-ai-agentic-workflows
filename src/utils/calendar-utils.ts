export function detectConflicts(
  working: any[],
  personal: any[]
): Array<{ working: any; personal: any }> {
  // TODO: use proper event typing
  const conflicts = [];
  for (const w of working) {
    const wStart = new Date(w.start.dateTime!);
    const wEnd = new Date(w.end.dateTime!);
    for (const p of personal) {
      const pStart = new Date(p.start.dateTime!);
      const pEnd = new Date(p.end.dateTime!);
      if (wStart < pEnd && pStart < wEnd)
        conflicts.push({ working: w, personal: p });
    }
  }
  return conflicts;
}
