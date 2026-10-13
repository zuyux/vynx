import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createTranslator } from 'next-intl';
import { proxy } from '../proxy.ts';
import { preferredLocale, localizedHref, stripLocale } from '../i18n/locale.ts';
import { createCopy } from '../i18n/copy-core.ts';
import en from '../messages/en.json' with { type: 'json' };
import es from '../messages/es.json' with { type: 'json' };
import source from '../messages/source.json' with { type: 'json' };
import { sessionDurationLabel } from '../lib/offer-terms.ts';
import { normalizeAlias } from '../lib/alias.ts';

function request(path, headers = {}) { return new NextRequest(`https://vynx.example${path}`, { headers }); }

test('Spanish device languages redirect while honoring explicit saved choices and quality weights', () => {
  assert.equal(preferredLocale('es-PE,es;q=0.9,en;q=0.8'), 'es');
  assert.equal(preferredLocale('en-US,es;q=0.9'), 'en');
  assert.equal(preferredLocale('es;q=0.2,en;q=0.8'), 'en');
  assert.equal(preferredLocale('fr-FR,es;q=0.7'), 'es');
  assert.equal(preferredLocale('es;q=0,en;q=0.5'), 'en');
  assert.equal(preferredLocale(null), 'en');
  assert.equal(preferredLocale('es-PE', 'en'), 'en');
  assert.equal(preferredLocale('en', 'es'), 'es');
  assert.equal(proxy(request('/?next=%2Fdashboard', { 'accept-language': 'es-PE' })).headers.get('location'), 'https://vynx.example/es?next=%2Fdashboard');
  assert.equal(proxy(request('/', { 'accept-language': 'es', cookie: 'VYNX_LOCALE=en' })).headers.get('location'), null);
});

test('Spanish URLs rewrite to existing routes without trusting incoming locale or destination headers', () => {
  const response = proxy(request('/es/dashboard/card?preview=1', { 'accept-language': 'en', 'x-vynx-locale': 'en', 'x-vynx-destination': '//evil.example' }));
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://vynx.example/dashboard/card?preview=1');
  assert.equal(response.headers.get('x-middleware-request-x-vynx-locale'), 'es');
  assert.equal(response.headers.get('x-middleware-request-x-vynx-destination'), '/dashboard/card?preview=1');
  assert.equal(response.cookies.get('VYNX_LOCALE'), undefined);
  const english = proxy(request('/en/docs', { 'accept-language': 'es' }));
  assert.equal(english.headers.get('location'), 'https://vynx.example/docs');
  assert.equal(english.cookies.get('VYNX_LOCALE').value, 'en');
});

test('language switches keep deep links, queries and hashes and never prefix assets, APIs or external URLs', () => {
  assert.equal(localizedHref('/dashboard/card?preview=1#offers', 'es'), '/es/dashboard/card?preview=1#offers');
  assert.equal(localizedHref('/es/dashboard/card?preview=1#offers', 'en'), '/dashboard/card?preview=1#offers');
  assert.equal(localizedHref('/es', 'en'), '/');
  assert.equal(localizedHref('/', 'es'), '/es');
  assert.equal(stripLocale('/es/profile/buy-alias'), '/profile/buy-alias');
  assert.equal(stripLocale('/esteban'), '/esteban');
  for (const href of ['/api/profile', '/_next/static/app.js', '/logo-white.svg', 'https://example.com', '//example.com', '#fees']) assert.equal(localizedHref(href, 'es'), href);
  assert.throws(() => normalizeAlias('es'));
  assert.throws(() => normalizeAlias('en'));
});

test('English and Spanish catalogs cover the same messages and preserve interpolation parameters', () => {
  assert.deepEqual(Object.keys(en.app).sort(), Object.keys(es.app).sort());
  assert.deepEqual(en.app, source);
  for (const key of Object.keys(source)) {
    assert.ok(es.app[key].trim(), key);
    assert.deepEqual([...source[key].matchAll(/\{v\d+\}/g)].map(x => x[0]).sort(), [...es.app[key].matchAll(/\{v\d+\}/g)].map(x => x[0]).sort(), key);
  }
  const intl = createTranslator({ locale: 'es', messages: es, namespace: 'app' });
  const t = createCopy((key, values) => values ? intl(key, values) : intl.raw(key), 'es');
  assert.equal(t('My Card'), 'Mi tarjeta');
  assert.equal(t(' Connect wallet '), ' Conectar billetera ');
  assert.equal(t('Hello, {v0}.', { v0: 'Fabohax' }), 'Hola, Fabohax.');
  assert.equal(t('Hello, Fabohax.'), 'Hola, Fabohax.');
  assert.equal(t('Creator-written bio'), 'Creator-written bio');
  assert.equal(t('New copy {v0}', { v0: 42 }), 'New copy 42');
  assert.equal(sessionDurationLabel(90, 'es'), '1,5 horas');
  assert.equal(sessionDurationLabel(60, 'es'), '1 hora');
});
