export const REVIEW_SCORES = ['overall_rating', 'punctuality', 'communication', 'fulfillment'] as const;
export type ReviewInput = { overall_rating: number; punctuality: number; communication: number; fulfillment: number; comment: string };
export type CallReview = ReviewInput & { created_at: string };
export type CreatorCallHistory = {
  verified_completed_calls: number;
  average_rating: number | null;
  review_count: number;
  comments: CallReview[];
  has_more: boolean;
};
export function reviewInput(value: Record<string, unknown>): ReviewInput | null {
  if (REVIEW_SCORES.some(field => !Number.isInteger(value[field]) || Number(value[field]) < 1 || Number(value[field]) > 5)
    || typeof value.comment !== 'string') return null;
  const comment = value.comment.trim();
  if (Array.from(comment).length < 1 || Array.from(comment).length > 2000) return null;
  return { overall_rating: Number(value.overall_rating), punctuality: Number(value.punctuality),
    communication: Number(value.communication), fulfillment: Number(value.fulfillment), comment };
}
