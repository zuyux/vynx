import sources from '../messages/source.json';
import { localizedHref, type Locale } from './locale';

const keys = new Map(Object.entries(sources).map(([key, source]) => [source, key]));
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const patterns = Object.entries(sources).filter(([, source]) => /\{v\d+\}/.test(source)).map(([key, source]) => {
  const names: string[] = [];
  const pattern = source.split(/(\{v\d+\})/).map(part => {
    if (/^\{v\d+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key, names, expression: new RegExp(`^${pattern}$`) };
});
type Translate = (key: string, values?: Record<string, string | number>) => string;
export function createCopy(translate: Translate, locale: Locale) {
  function copy<T>(value: T, values?: Record<string, string | number | boolean | null | undefined>): T {
    if (typeof value !== 'string') return value;
    let key = keys.get(normalize(value));
    if (!key && !values) {
      for (const pattern of patterns) {
        const match = pattern.expression.exec(normalize(value));
        if (match) { key = pattern.key; values = Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])); break; }
      }
    }
    if (!key) return (values ? value.replace(/\{(v\d+)\}/g, (_, name) => String(values[name] ?? '')) : value) as T;
    const params = values && Object.fromEntries(Object.entries(values).map(([name, value]) => [name, typeof value === 'number' ? value : String(value ?? '')]));
    const result = translate(key, params);
    // Preserve spaces around inline links and emphasized fragments.
    return (value.match(/^\s*/)?.[0] + result + value.match(/\s*$/)?.[0]) as T;
  }
  return Object.assign(copy, { locale, href: (href: string) => localizedHref(href, locale) });
}
