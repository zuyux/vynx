import type { SponsorRequest } from './sponsorship-domain';

export type CampaignFilter = 'all' | 'pending' | 'approved' | 'active' | 'ended' | 'rejected';
export const campaignFilters: { value: CampaignFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' }, { value: 'active', label: 'Active' },
  { value: 'ended', label: 'Ended' }, { value: 'rejected', label: 'Rejected' },
];

export function campaignState(campaign: SponsorRequest, now = Date.now()): Exclude<CampaignFilter, 'all'> {
  if (campaign.status !== 'active') return campaign.status;
  return campaign.starts_at && campaign.ends_at && Date.parse(campaign.starts_at) <= now && Date.parse(campaign.ends_at) > now ? 'active' : 'ended';
}

export function nextCampaignAction(campaign: SponsorRequest, wallet: string, recovering = false, now = Date.now()) {
  const state = campaignState(campaign, now);
  const creator = campaign.creator_wallet === wallet;
  if (state === 'pending') return creator ? "Review the ad and decide whether it fits your community." : "The creator is reviewing your proposal. Do not pay yet.";
  if (state === 'approved') return creator ? "Proposal approved. The brand must pay before publication begins." : recovering ? "A payment has been submitted. Verify its signature to activate the campaign without paying again." : "Your proposal was approved. Pay to start the publication period.";
  if (state === 'active') return "The ad is published. You can view the payment and end date.";
  if (state === 'ended') return "The publication period has ended. Your payment receipt is still available.";
  return creator ? "You rejected this proposal. Payment was not enabled." : "The creator rejected this proposal. Do not make a payment.";
}
