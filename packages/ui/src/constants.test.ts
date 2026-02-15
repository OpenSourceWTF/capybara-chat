/**
 * Tests for constants
 */

import { describe, it, expect } from 'vitest';
import { LAYOUT_MODES, PANES, STORAGE_KEYS } from './constants';

describe('constants', () => {
  describe('LAYOUT_MODES', () => {
    it('should export NORMAL mode', () => {
      expect(LAYOUT_MODES.NORMAL).toBe('normal');
    });

    it('should export FOCUS mode', () => {
      expect(LAYOUT_MODES.FOCUS).toBe('focus');
    });

    it('should export IMMERSIVE mode', () => {
      expect(LAYOUT_MODES.IMMERSIVE).toBe('immersive');
    });

    it('should have exactly three modes', () => {
      expect(Object.keys(LAYOUT_MODES)).toHaveLength(3);
    });
  });

  describe('PANES', () => {
    it('should have CONTENT pane configuration', () => {
      expect(PANES.CONTENT).toBeDefined();
      expect(PANES.CONTENT.MIN_WIDTH).toBe(400);
    });

    it('should have CHAT pane configuration', () => {
      expect(PANES.CHAT).toBeDefined();
      expect(PANES.CHAT.DEFAULT_WIDTH).toBe(320);
    });

    it('should have SESSIONS pane configuration', () => {
      expect(PANES.SESSIONS).toBeDefined();
      expect(PANES.SESSIONS.DEFAULT_WIDTH).toBe(280);
      expect(PANES.SESSIONS.COLLAPSED_WIDTH).toBe(56);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should have all required keys', () => {
      expect(STORAGE_KEYS.THEME).toBeDefined();
      expect(STORAGE_KEYS.CURRENT_SESSION).toBeDefined();
      expect(STORAGE_KEYS.SESSIONS_PANE_WIDTH).toBeDefined();
      expect(STORAGE_KEYS.CHAT_PANE_WIDTH).toBeDefined();
    });
  });
});
