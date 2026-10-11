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
