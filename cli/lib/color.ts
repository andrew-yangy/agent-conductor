/**
 * Minimal ANSI color helpers — zero dependencies.
 * Respects NO_COLOR env var per https://no-color.org/
 */

const enabled = !process.env['NO_COLOR'] && process.stdout.isTTY !== false;

function wrap(open: string, close: string): (s: string) => string {
  if (!enabled) return (s: string) => s;
  return (s: string) => `\x1b[${open}m${s}\x1b[${close}m`;
}

export const c = {
  bold:    wrap('1', '22'),
  dim:     wrap('2', '22'),
  red:     wrap('31', '39'),
  green:   wrap('32', '39'),
  yellow:  wrap('33', '39'),
  blue:    wrap('34', '39'),
  magenta: wrap('35', '39'),
  cyan:    wrap('36', '39'),
  white:   wrap('37', '39'),
};
