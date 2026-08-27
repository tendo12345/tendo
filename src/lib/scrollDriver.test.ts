// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activeSubscriberCount, observeProgress } from './scrollDriver';

/*
  The driver's contract is what every scroll effect in the app depends on, and two parts of it
  are worth pinning because breaking either is silent:

  1. It writes an immediate value on subscribe. Without that, anything already on screen at
     load sits at its default until the first scroll — which for a hero means it never
     animates for a user who does not scroll.
  2. It tears down completely when the last subscriber leaves. A driver that keeps its scroll
     listener alive after every component using it has unmounted is a leak that only shows up
     as an unexplained frame cost on pages with no animation at all.
*/

function elementAt(top: number, height: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('scrollDriver', () => {
  it('writes a value immediately on subscribe, before any scroll happens', () => {
    const write = vi.fn();
    const stop = observeProgress(elementAt(100, 200), write);

    expect(write).toHaveBeenCalled();
    stop();
  });

  it('reports 0 for an element below the viewport and 1 for one fully above it', () => {
    window.innerHeight = 800;

    const below = vi.fn();
    const stopBelow = observeProgress(elementAt(800, 200), below);
    expect(below.mock.calls[0][0]).toBeCloseTo(0, 2);
    stopBelow();

    const above = vi.fn();
    const stopAbove = observeProgress(elementAt(-200, 200), above);
    expect(above.mock.calls[0][0]).toBeCloseTo(1, 2);
    stopAbove();
  });

  it('clamps past both ends rather than reporting negative or >1 progress', () => {
    window.innerHeight = 800;

    const wayBelow = vi.fn();
    const stopA = observeProgress(elementAt(5000, 200), wayBelow);
    expect(wayBelow.mock.calls[0][0]).toBe(0);
    stopA();

    const wayAbove = vi.fn();
    const stopB = observeProgress(elementAt(-5000, 200), wayAbove);
    expect(wayAbove.mock.calls[0][0]).toBe(1);
    stopB();
  });

  it('releases every subscriber on unsubscribe', () => {
    const stopA = observeProgress(elementAt(0, 100), vi.fn());
    const stopB = observeProgress(elementAt(0, 100), vi.fn());
    expect(activeSubscriberCount()).toBe(2);

    stopA();
    stopB();
    expect(activeSubscriberCount()).toBe(0);
  });

  it('removes its window listeners once the last subscriber leaves', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const stop = observeProgress(elementAt(0, 100), vi.fn());
    stop();

    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('scroll');
    expect(removed).toContain('resize');
    remove.mockRestore();
  });

  it('survives a zero-height element instead of dividing by zero', () => {
    window.innerHeight = 0;
    const write = vi.fn();
    const stop = observeProgress(elementAt(0, 0), write);

    expect(Number.isFinite(write.mock.calls[0][0])).toBe(true);
    stop();
  });
});
