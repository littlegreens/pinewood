/** Valori CSS allineati a react-native-safe-area-context (mobile). */
export const safeBottomCss = (extra = 16) =>
  `max(${extra}px, calc(env(safe-area-inset-bottom) + ${extra}px))`;

export const safeTopCss = (extra = 0) =>
  `max(${extra}px, calc(env(safe-area-inset-top) + ${extra}px))`;
