import { TestIntlProvider } from "./helpers/intl-provider.tsx";
import enMessages from "../messages/en.json" with { type: "json" };
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError, apiFailure } from '../lib/wallet-session.ts';
import { UserFacingError, responseError, userErrorMessage } from '../lib/user-facing-error.ts';
import { claimErrorMessage } from '../lib/claim-errors.ts';
import { LoadingState } from '../components/LoadingState.tsx';
import PageErrorModule from '../app/error.tsx';
import GlobalErrorModule from '../app/global-error.tsx';

const PageError = typeof PageErrorModule === 'function' ? PageErrorModule : PageErrorModule.default;
const GlobalError = typeof GlobalErrorModule === 'function' ? GlobalErrorModule : GlobalErrorModule.default;
const internal = 'postgres://admin:secret@private-host/cards_users: relation missing';

test('unexpected API failures hide exception details and retain CORS and no-store headers', async () => {
  for (const reason of [new Error(internal), new TypeError(internal), internal, null, new ApiError(internal, 503, 'RPC_UNAVAILABLE')]) {
    const response = apiFailure(reason, { 'Access-Control-Allow-Origin': '*' });
    assert.equal(response.status, reason instanceof ApiError ? 503 : 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const body = await response.json();
    assert.equal(body.error, 'Something went wrong. Please try again shortly.');
    if (reason instanceof ApiError) assert.equal(body.code, 'RPC_UNAVAILABLE');
    else assert.equal(body.code, undefined);
  }
});

test('expected validation and recovery messages stay actionable; malformed JSON stays private', async () => {
  const validation = apiFailure(new UserFacingError('Choose a valid HTTPS link.'));
  assert.equal(validation.status, 400);
  assert.equal((await validation.json()).error, 'Choose a valid HTTPS link.');
  const conflict = apiFailure(new ApiError('Reload your saved profile before retrying.', 409, 'PROFILE_CHANGED'));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, 'PROFILE_CHANGED');
  const malformed = apiFailure(new SyntaxError(internal));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.includes('secret'), false);
});

test('client feedback hides SDK and server failures without losing payment recovery codes', () => {
  const fallback = 'Unable to load. Please retry.';
  assert.equal(userErrorMessage(new Error(internal), fallback), fallback);
  assert.equal(userErrorMessage(new UserFacingError('Choose a PNG image.'), fallback), 'Choose a PNG image.');
  assert.match(userErrorMessage({ code: 4001, message: internal }, fallback), /approval was cancelled/);
  const failure = responseError({ status: 503 }, { error: internal, code: 'PAYMENT_PENDING' }, fallback);
  assert.equal(failure.message, fallback);
  assert.equal(failure.code, 'PAYMENT_PENDING');
  assert.match(claimErrorMessage(failure, 'verify', true), /Retry verification instead of paying again/);
  assert.equal(claimErrorMessage(new Error(internal), 'prepare', false).includes('secret'), false);
  assert.equal(claimErrorMessage({ code: 'SPONSOR_UNAVAILABLE', message: internal }, 'prepare', false).includes('secret'), false);
});

test('loading states announce progress and page boundaries never render error messages or digests', () => {
  const loading = renderToStaticMarkup(createElement(TestIntlProvider, { locale: 'en', messages: enMessages, timeZone: 'America/Lima' }, createElement(LoadingState, { label: 'Loading creator card…' })));
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading creator card/);
  for (const Component of [PageError, GlobalError]) {
    const html = renderToStaticMarkup(createElement(TestIntlProvider, { locale: 'en', messages: enMessages, timeZone: 'America/Lima' }, createElement(Component, { error: Object.assign(new Error(internal), { digest: 'private-digest' }), retry() {} })));
    assert.match(html, /Try again/);
    assert.equal(html.includes('secret'), false);
    assert.equal(html.includes('private-digest'), false);
  }
});
