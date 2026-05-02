import { jsonResponse } from '../lib/response.js';

export function handleListPlans(req, res, ctx) {
  const plans = ctx.planReader.getPlans();
  jsonResponse(res, 200, { plans });
}

export function handleGetPlan(req, res, ctx) {
  const filename = decodeURIComponent(req.url.replace('/api/plans/', ''));
  const plan = ctx.planReader.getPlan(filename);
  if (!plan) return jsonResponse(res, 404, { error: 'Plan not found' });
  jsonResponse(res, 200, plan);
}
