// A stable key for the current device+browser, used to save/restore the
// dashboard layout per device (no user accounts — this is the grouping key).
// Deliberately coarse (form-factor + browser family) so the same laptop in the
// same browser always maps to the same saved layout.
export function getDeviceKey(): string {
  const ua = navigator.userAgent
  const browser = /\bEdg\//.test(ua)
    ? 'edge'
    : /\bOPR\/|\bOpera\b/.test(ua)
      ? 'opera'
      : /\bChrome\//.test(ua)
        ? 'chrome'
        : /\bFirefox\//.test(ua)
          ? 'firefox'
          : /\bSafari\//.test(ua)
            ? 'safari'
            : 'other'

  const device = /\b(iPad|Tablet)\b/.test(ua)
    ? 'tablet'
    : /\b(Mobi|Android|iPhone|iPod)\b/.test(ua)
      ? 'mobile'
      : 'desktop'

  return `${device}:${browser}`
}
