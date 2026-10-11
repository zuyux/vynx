import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignState, nextCampaignAction } from '../lib/sponsorship-workspace.ts';

const campaign = {
  creator_wallet: 'creator', brand_wallet: 'brand', status: 'active',
  starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-08T00:00:00Z',
};
test('campaign leaves the active filter at the exact expiry time', () => {
  assert.equal(campaignState(campaign, Date.parse('2026-10-07T23:59:59Z')), 'active');
  assert.equal(campaignState(campaign, Date.parse(campaign.ends_at)), 'ended');
  for (const status of ['pending', 'approved', 'rejected']) {
    assert.equal(campaignState({...campaign,status}, Date.parse(campaign.ends_at)), status);
  }
});
test('next action distinguishes review, waiting and payment recovery', () => {
  const pending = {...campaign,status:'pending'};
  assert.match(nextCampaignAction(pending, 'creator'), /Review the ad/);
  assert.match(nextCampaignAction(pending, 'brand'), /Do not pay yet/);
  const approved = {...campaign,status:'approved'};
  assert.match(nextCampaignAction(approved, 'creator'), /The brand must pay/);
  assert.match(nextCampaignAction(approved, 'brand'), /Pay to start/);
  assert.match(nextCampaignAction(approved, 'brand', true), /without paying again/);
  assert.match(nextCampaignAction({...campaign,status:'rejected'}, 'brand'), /Do not make a payment/);
  assert.match(nextCampaignAction(campaign, 'brand', false, Date.parse(campaign.ends_at)), /has ended/);
});
