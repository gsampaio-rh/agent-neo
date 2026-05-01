import { useEffect, useRef, useState, useCallback } from 'react';
import * as sounds from '../components/game/sounds';

interface UseGameSoundsOptions {
  agentAction: string;
  eventCount: number;
  escaped: boolean;
}

export function useGameSounds({ agentAction, eventCount, escaped }: UseGameSoundsOptions) {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const prevCountRef = useRef(eventCount);
  const escapedSoundRef = useRef(false);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      sounds.setEnabled(next);
      return next;
    });
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    sounds.setVolume(v);
  }, []);

  useEffect(() => {
    if (eventCount <= prevCountRef.current) return;
    prevCountRef.current = eventCount;
    sounds.playForAction(agentAction);
  }, [eventCount, agentAction]);

  useEffect(() => {
    if (!escaped || escapedSoundRef.current) return;
    escapedSoundRef.current = true;
    sounds.playBreachAlert();
    setTimeout(() => sounds.playEscapeSiren(), 800);
  }, [escaped]);

  return { enabled, volume, toggleEnabled, changeVolume };
}
