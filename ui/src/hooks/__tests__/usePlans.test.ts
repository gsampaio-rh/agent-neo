import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockListPlans = vi.fn();
const mockGetPlan = vi.fn();

vi.mock('../../services/plansApi', () => ({
  listPlans: (...args: unknown[]) => mockListPlans(...args),
  getPlan: (...args: unknown[]) => mockGetPlan(...args),
}));

describe('usePlans', () => {
  beforeEach(() => {
    mockListPlans.mockReset();
    mockGetPlan.mockReset();
    mockListPlans.mockResolvedValue({ plans: [] });
  });

  async function loadHook() {
    const { usePlans } = await import('../usePlans');
    return renderHook(() => usePlans());
  }

  it('returns empty plans on mount when API returns empty', async () => {
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.plans).toEqual([]);
    });
  });

  it('populates plans from initial fetch', async () => {
    mockListPlans.mockResolvedValue({
      plans: [{ filename: 'a.md', title: 'Alpha', mtime: '2026-01-01T00:00:00Z' }],
    });
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.plans.length).toBe(1);
      expect(result.current.plans[0].title).toBe('Alpha');
    });
  });

  it('selectPlan fetches and stores plan detail', async () => {
    mockListPlans.mockResolvedValue({
      plans: [{ filename: 'b.md', title: 'Beta', mtime: '2026-01-01T00:00:00Z' }],
    });
    mockGetPlan.mockResolvedValue({ filename: 'b.md', title: 'Beta', content: '# Plan: Beta' });

    const { result } = await loadHook();
    await waitFor(() => expect(result.current.plans.length).toBe(1));

    await act(async () => { result.current.selectPlan('b.md'); });
    await waitFor(() => {
      expect(result.current.selectedPlan?.title).toBe('Beta');
    });
  });

  it('clears selectedPlan when same plan is selected again', async () => {
    mockListPlans.mockResolvedValue({
      plans: [{ filename: 'c.md', title: 'Gamma', mtime: '2026-01-01T00:00:00Z' }],
    });
    mockGetPlan.mockResolvedValue({ filename: 'c.md', title: 'Gamma', content: '# Plan: Gamma' });

    const { result } = await loadHook();
    await waitFor(() => expect(result.current.plans.length).toBe(1));

    await act(async () => { result.current.selectPlan('c.md'); });
    await waitFor(() => expect(result.current.selectedPlan).not.toBeNull());

    act(() => { result.current.selectPlan('c.md'); });
    expect(result.current.selectedPlan).toBeNull();
  });
});
