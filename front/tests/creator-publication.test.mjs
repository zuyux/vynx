import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DRAFT, draftFromProfile, publicationFields, readDraft } from '../lib/creator-draft.ts';
import { challengeMessage } from '../lib/sponsorship-server.ts';

const design = {...EMPTY_DRAFT,alias:'creator_1',name:'Creator',bio:'My community',links:[{id:'one',title:'My project',url:'https://example.com'}]};
test('older profiles retain their website without restoring intentionally removed links', () => {
  const profile = {alias:'creator_1',display_name:'Creator',bio:'Bio',website:'https://example.com'};
  assert.equal(draftFromProfile(profile).links[0].url,'https://example.com/');
  assert.deepEqual(draftFromProfile({...profile,design:{...design,links:[]}}).links,[]);
  assert.deepEqual(draftFromProfile({...profile,website:'javascript:alert(1)'}).links,[]);
});
test('publication validates and normalizes design without arbitrary fields', () => {
  const result = publicationFields({...design,name:' Creator ',admin:true,links:[{...design.links[0],unsafe:true}]});
  assert.equal(result.name,'Creator');
  assert.equal(result.links[0].url,'https://example.com/');
  assert.equal('admin' in result,false);
  assert.equal('unsafe' in result.links[0],false);
});
test('publication rejects malformed designs and unsafe public links', () => {
  for (const value of [null,{}, {...design,name:''},{...design,alias:'../creator'}, {...design,theme:'other'},
    {...design,avatar:'data:image/svg+xml;base64,PHN2Zz4='},
    {...design,links:[{...design.links[0],url:'javascript:alert(1)'}]},
    {...design,socials:{...design.socials,x:'http://example.com'}},
    {...design,links:[design.links[0],design.links[0]]}]) assert.throws(() => publicationFields(value));
  assert.throws(() => readDraft('{broken'));
});
test('publication authorization binds images without putting image bytes in the wallet prompt', () => {
  const first = {...design,avatar:'data:image/png;base64,AAAA'};
  const second = {...first,avatar:'data:image/png;base64,BBBB'};
  const args = ['https://vynx.example','wallet','save-design'];
  const message = challengeMessage(...args,first,'nonce','expiry');
  assert.notEqual(message,challengeMessage(...args,second,'nonce','expiry'));
  assert.equal(message.includes(first.avatar),false);
  assert.match(message,/Publish the design/);
  assert.match(message,/This signature does not transfer funds/);
});

test('publication enforces the server image size limit', () => {
  const tooLarge = 'data:image/png;base64,' + 'A'.repeat(1398104);
  assert.throws(() => publicationFields({...design,avatar:tooLarge}));
  assert.throws(() => publicationFields({...design,avatar:'data:image/png;base64,AAA'}));
});

test('appearance colors and glow survive publication while older drafts remain compatible', () => {
  for (const accent of ['purple', 'red', 'blue', 'cyan', 'yellow', 'orange', 'black', 'white']) {
    const result = publicationFields({...design, accent, theme: 'light', cardGlow: true, buttonGlow: true});
    assert.equal(result.accent, accent);
    assert.equal(result.cardGlow, true);
    assert.equal(result.buttonGlow, true);
    assert.equal(result.theme, 'light');
  }
  assert.equal(readDraft(JSON.stringify(design)).cardGlow, false);
  assert.equal(readDraft(JSON.stringify(design)).buttonGlow, false);
  for (const change of [{accent: 'invalid'}, {cardGlow: 'true'}, {buttonGlow: 1}]) {
    assert.throws(() => publicationFields({...design, ...change}));
  }
});

test('offer rows survive saving and publication with normalized safe destinations', () => {
  const offer = { id: 'offer-1', type: 'digital', title: ' Guide ', description: ' A useful guide ', price: ' 25 ', url: 'https://example.com', extra: true };
  const result = publicationFields({ ...design, offers: [offer] });
  assert.deepEqual(result.offers, [{ id: 'offer-1', type: 'digital', title: 'Guide', description: 'A useful guide', price: '25', url: 'https://example.com/' }]);
  assert.deepEqual(readDraft(JSON.stringify(result)).offers, result.offers);
  const legacy = { ...EMPTY_DRAFT };
  delete legacy.offers;
  assert.deepEqual(readDraft(JSON.stringify(legacy)).offers, []);
  for (const invalid of [{ ...offer, url: 'javascript:alert(1)' }, { ...offer, title: ' ' }, { ...offer, type: 'unknown' }]) {
    assert.throws(() => publicationFields({ ...design, offers: [invalid] }));
  }
  assert.throws(() => publicationFields({ ...design, offers: [offer, offer] }));
  assert.throws(() => publicationFields({ ...design, offers: Array.from({ length: 9 }, (_, index) => ({ ...offer, id: String(index) })) }));
});

test('more details pages are optional for every offer and always require safe HTTPS URLs', () => {
  const offer = { id: 'details', type: 'digital', title: 'Guide', description: '', price: '25', url: '', billingPeriod: 'session' };
  for (const billingPeriod of ['session', 'month']) {
    assert.equal(publicationFields({ ...design, offers: [{ ...offer, billingPeriod }] }).offers[0].url, '');
    assert.equal(publicationFields({ ...design, offers: [{ ...offer, billingPeriod, url: 'https://example.com' }] }).offers[0].url, 'https://example.com/');
    for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) {
      assert.throws(() => publicationFields({ ...design, offers: [{ ...offer, billingPeriod, url }] }));
    }
  }
});
