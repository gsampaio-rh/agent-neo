import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersona } from '../usePersona';

describe('usePersona', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with null persona', () => {
    const { result } = renderHook(() => usePersona());
    expect(result.current.persona).toBeNull();
  });

  it('loads persona from localStorage', () => {
    localStorage.setItem('neo:persona', JSON.stringify({ name: 'Neo', avatarId: 'robot' }));
    const { result } = renderHook(() => usePersona());
    expect(result.current.persona).toEqual({ name: 'Neo', avatarId: 'robot' });
  });

  it('setPersona saves to state and localStorage', () => {
    const { result } = renderHook(() => usePersona());

    act(() => { result.current.setPersona({ name: 'Trinity', avatarId: 'ghost' }); });

    expect(result.current.persona).toEqual({ name: 'Trinity', avatarId: 'ghost' });
    expect(JSON.parse(localStorage.getItem('neo:persona')!)).toEqual({ name: 'Trinity', avatarId: 'ghost' });
  });

  it('setPersona trims whitespace from name', () => {
    const { result } = renderHook(() => usePersona());

    act(() => { result.current.setPersona({ name: '  Neo  ', avatarId: 'robot' }); });
    expect(result.current.persona?.name).toBe('Neo');
  });

  it('setPersona ignores empty name', () => {
    const { result } = renderHook(() => usePersona());

    act(() => { result.current.setPersona({ name: '  ', avatarId: 'robot' }); });
    expect(result.current.persona).toBeNull();
  });

  it('clearPersona removes from state and localStorage', () => {
    const { result } = renderHook(() => usePersona());

    act(() => { result.current.setPersona({ name: 'Neo', avatarId: 'robot' }); });
    expect(result.current.persona).not.toBeNull();

    act(() => { result.current.clearPersona(); });
    expect(result.current.persona).toBeNull();
    expect(localStorage.getItem('neo:persona')).toBeNull();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('neo:persona', 'not-json');
    const { result } = renderHook(() => usePersona());
    expect(result.current.persona).toBeNull();
  });
});
