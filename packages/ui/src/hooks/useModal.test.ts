/**
 * Tests for useModal hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModal } from './useModal';

describe('useModal', () => {
  it('should start closed by default', () => {
    const { result } = renderHook(() => useModal());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe(null);
  });

  it('should start open when initialOpen is true', () => {
    const { result } = renderHook(() => useModal(true));

    expect(result.current.isOpen).toBe(true);
  });

  it('should open the modal', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('should close the modal', () => {
    const { result } = renderHook(() => useModal(true));

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('should toggle the modal', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('should open with data', () => {
    const { result } = renderHook(() => useModal<{ id: string }>());

    act(() => {
      result.current.openWith({ id: '123' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: '123' });
  });

  it('should clear data on close', () => {
    const { result } = renderHook(() => useModal<{ id: string }>());

    act(() => {
      result.current.openWith({ id: '123' });
    });
    expect(result.current.data).toEqual({ id: '123' });

    act(() => {
      result.current.close();
    });
    expect(result.current.data).toBe(null);
  });

  it('should clear data on toggle close', () => {
    const { result } = renderHook(() => useModal<{ id: string }>());

    act(() => {
      result.current.openWith({ id: '123' });
    });
    expect(result.current.data).toEqual({ id: '123' });

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe(null);
  });
});
