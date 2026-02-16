/**
 * Badge Variants Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getSessionStatusVariant,
  getPriorityVariant,
} from './badge-variants';

describe('getSessionStatusVariant', () => {
  it('returns correct variant for PENDING', () => {
    expect(getSessionStatusVariant('PENDING')).toEqual({ variant: 'soft', intent: 'neutral' });
  });

  it('returns correct variant for RUNNING', () => {
    expect(getSessionStatusVariant('RUNNING')).toEqual({ variant: 'solid', intent: 'primary' });
  });

  it('returns correct variant for PAUSED', () => {
    expect(getSessionStatusVariant('PAUSED')).toEqual({ variant: 'outline', intent: 'warning' });
  });

  it('returns correct variant for WAITING_HUMAN', () => {
    expect(getSessionStatusVariant('WAITING_HUMAN')).toEqual({ variant: 'solid', intent: 'warning' });
  });

  it('returns correct variant for COMPLETE', () => {
    expect(getSessionStatusVariant('COMPLETE')).toEqual({ variant: 'soft', intent: 'success' });
  });

  it('returns correct variant for FAILED', () => {
    expect(getSessionStatusVariant('FAILED')).toEqual({ variant: 'solid', intent: 'danger' });
  });

  it('returns default variant for unknown status', () => {
    expect(getSessionStatusVariant('UNKNOWN' as any)).toEqual({ variant: 'soft', intent: 'secondary' });
  });
});

describe('getPriorityVariant', () => {
  it('returns correct variant for critical', () => {
    expect(getPriorityVariant('critical')).toEqual({ variant: 'solid', intent: 'danger' });
  });

  it('returns correct variant for high', () => {
    expect(getPriorityVariant('high')).toEqual({ variant: 'soft', intent: 'warning' });
  });

  it('returns correct variant for medium', () => {
    expect(getPriorityVariant('medium')).toEqual({ variant: 'soft', intent: 'info' });
  });

  it('returns default variant for low/unknown priority', () => {
    expect(getPriorityVariant('low')).toEqual({ variant: 'ghost', intent: 'neutral' });
    expect(getPriorityVariant('unknown')).toEqual({ variant: 'ghost', intent: 'neutral' });
  });
});
