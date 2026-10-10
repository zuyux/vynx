import { storedCreatorImage } from './creator-image-policy';

export type CreatorLink = { id: string; title: string; url: string };
export type CreatorDraft = {
  version: 1; alias: string; name: string; bio: string; avatar: string; cover: string;
  accent: 'mint' | 'violet' | 'rose'; theme: 'dark' | 'light'; rounded: boolean;
  links: CreatorLink[]; socials: { instagram: string; youtube: string; x: string };
};
export const DRAFT_KEY = 'vynx:creator-draft:v1';
export const EMPTY_DRAFT: CreatorDraft = {
  version: 1, alias: '', name: '', bio: '', avatar: '', cover: '', accent: 'mint',
  theme: 'dark', rounded: true, links: [], socials: { instagram: '', youtube: '', x: '' },
};
export function safeLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function readDraft(raw: string | null): CreatorDraft {
  if (!raw) return structuredClone(EMPTY_DRAFT);
  const value = JSON.parse(raw);
  const bounded = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const image = (v: unknown) => {
    if (v === '') return true;
    if (typeof v === 'string' && v.length <= 2048 && storedCreatorImage(v)) return true;
    if (!bounded(v, 1500000) || typeof v !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
    const base64 = v.slice(v.indexOf(',') + 1);
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return base64.length % 4 === 0 && base64.length * 3 / 4 - padding <= 1024 * 1024;
  };
  if (!value || value.version !== 1 || !bounded(value.alias, 30) || !bounded(value.name, 60) || !bounded(value.bio, 280) ||
      !image(value.avatar) || !image(value.cover) || !['mint', 'violet', 'rose'].includes(value.accent) ||
      !['dark', 'light'].includes(value.theme) || typeof value.rounded !== 'boolean' ||
      !Array.isArray(value.links) || value.links.length > 8 ||
      !value.links.every((link: CreatorLink) => link && bounded(link.id, 60) && bounded(link.title, 60) && bounded(link.url, 500)) ||
      new Set(value.links.map((link: CreatorLink) => link.id)).size !== value.links.length ||
      !value.socials || !['instagram', 'youtube', 'x'].every(key => bounded(value.socials[key], 500))) {
    throw new Error('El borrador guardado no es compatible. Puedes crear uno nuevo.');
  }
  // Return only supported fields; never persist arbitrary client properties.
  return { version: 1, alias: value.alias, name: value.name, bio: value.bio,
    avatar: value.avatar, cover: value.cover, accent: value.accent, theme: value.theme,
    rounded: value.rounded, links: value.links.map((link: CreatorLink) => ({ id: link.id, title: link.title, url: link.url })),
    socials: { instagram: value.socials.instagram, youtube: value.socials.youtube, x: value.socials.x } };
}
export function publicationFields(value: unknown): CreatorDraft {
  const draft = readDraft(JSON.stringify(value) ?? null);
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  return { ...draft, name: draft.name.trim(), bio: draft.bio.trim(),
    links: draft.links.map(link => ({ ...link, title: link.title.trim(), url: safeLink(link.url)! })),
    socials: { instagram: draft.socials.instagram ? safeLink(draft.socials.instagram)! : '',
      youtube: draft.socials.youtube ? safeLink(draft.socials.youtube)! : '', x: draft.socials.x ? safeLink(draft.socials.x)! : '' } };
}
export function draftFromProfile(profile: { alias: string; display_name: string; bio: string; website?: string; design?: unknown }): CreatorDraft {
  const draft = profile.design ? readDraft(JSON.stringify(profile.design)) : structuredClone(EMPTY_DRAFT);
  if (!profile.design && profile.website && safeLink(profile.website)) {
    draft.links = [{ id: 'website', title: 'Mi sitio y mis proyectos', url: safeLink(profile.website)! }];
  }
  return { ...draft, alias: profile.alias, name: profile.display_name, bio: profile.bio };
}
export function validateDraft(draft: CreatorDraft): string | null {
  if (!/^[a-z0-9_]{1,30}$/.test(draft.alias)) return 'El alias debe tener entre 1 y 30 letras, números o guiones bajos.';
  if (!draft.name.trim()) return 'Agrega tu nombre de creador.';
  if (draft.links.some(link => !link.title.trim() || !safeLink(link.url))) return 'Completa el título y un enlace HTTPS válido en cada enlace.';
  if (Object.values(draft.socials).some(url => url && !safeLink(url))) return 'Usa enlaces HTTPS válidos en tus redes sociales.';
  return null;
}
