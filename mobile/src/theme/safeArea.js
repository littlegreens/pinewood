/** Padding uniforme rispetto alle barre di sistema (status / navigation). */
export function safeBottom(insets, extra = 16) {
  return Math.max(insets?.bottom ?? 0, 0) + extra;
}

export function safeTop(insets, extra = 0) {
  return Math.max(insets?.top ?? 0, 0) + extra;
}
