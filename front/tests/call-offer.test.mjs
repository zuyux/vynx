import test from 'node:test';
import assert from 'node:assert/strict';
import { callOfferFields, callOfferResponse, callPrice, callPriceUnits } from '../lib/call-offer.ts';

const input = { title: '  Design mentoring  ', description: '  Review your portfolio and plan next steps.  ', duration_minutes: 30, price: '12.000001', timezone: 'America/Lima', availability: [{ weekday: 1, start: '09:00', end: '12:00' }], accepting: true };
test('call offer prices use exact USDC units and fields exclude client ownership', () => {
 const fields=callOfferFields({...input, creator_wallet:'attacker', id:'forged', price_units:1});
 assert.equal(fields.price_units,12000001);assert.equal(fields.title,'Design mentoring');assert.equal(fields.currency,'USDC');assert.equal(fields.cluster,'devnet');assert.equal(fields.creator_wallet,undefined);
 const response=callOfferResponse({...fields, id:'offer', updated_at:'now', creator_wallet:'private'});
 assert.equal(response.price,'12.000001');assert.equal(response.creator_wallet,undefined);assert.equal(response.price_units,undefined);
 for(const value of ['0.01','1','100','1000','0.010001'])assert.equal(callPrice(callPriceUnits(value)),value);
 for(const price of ['0','-1','1000.000001','1e2','NaN','1.0000001',1])assert.throws(()=>callPriceUnits(price));
});
test('weekly availability sorts, allows adjacent windows and rejects overlap, overnight and short windows', () => {
 const adjacent=[{weekday:5,start:'12:00',end:'13:00'},{weekday:1,start:'10:00',end:'11:00'},{weekday:1,start:'09:00',end:'10:00'}];
 assert.equal(callOfferFields({...input, availability:adjacent}).availability[0].start,'09:00');
 for(const availability of [[],[{weekday:7,start:'09:00',end:'12:00'}],[{weekday:1,start:'09:10',end:'12:00'}],[{weekday:1,start:'23:00',end:'01:00'}],[{weekday:1,start:'09:00',end:'09:15'}],[{weekday:1,start:'24:00',end:'12:00'}],[...input.availability,{weekday:1,start:'10:00',end:'13:00'}],Array(29).fill(input.availability[0])])assert.throws(()=>callOfferFields({...input,availability}));
 assert.deepEqual(callOfferFields({...input,availability:[],accepting:false}).availability,[]);
});
test('duration, descriptive fields, pause state and IANA timezone are validated', () => {
 for(const patch of [{title:'x'},{description:'short'},{duration_minutes:0},{duration_minutes:31},{duration_minutes:241},{duration_minutes:'30'},{accepting:'yes'},{timezone:'UTC+3'},{timezone:'Mars/Olympus'},{timezone:'+03:00'}])assert.throws(()=>callOfferFields({...input,...patch}));
 for(const timezone of ['UTC','America/Lima','America/New_York','Europe/Madrid'])assert.equal(callOfferFields({...input,timezone}).timezone,timezone);
});
