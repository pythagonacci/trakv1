export function getDefaultSubtabForEmptyParent<T extends { id: string; position: number }>(
  tabId: string,
  tabs: Array<T & { children?: T[] }>,
  hasOwnContent: boolean,
): T | null {
  if (hasOwnContent) return null;

  const parentTab = tabs.find((tab) => tab.id === tabId);
  if (!parentTab?.children || parentTab.children.length === 0) {
    return null;
  }

  return [...parentTab.children].sort((a, b) => a.position - b.position)[0] ?? null;
}
