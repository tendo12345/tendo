// @vitest-environment jsdom

/**
 * The reduced-motion path, which no browser check in this repo can reach — the preview tools
 * cannot emulate `prefers-reduced-motion`, so this is the only proof it works.
 *
 * Two halves, both required: the solved cube is fully drawn from first paint (lit, posed,
 * every face coloured), AND the rig never starts — no animation frame is requested and no
 * observer is created. A cube that rendered correctly but kept animating would pass the first
 * half and fail the person who asked for stillness.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockSculpture } from './BlockSculpture';
import { toMatrix3d, worldRotation } from './cubeMechanics';

function stubMedia(matches: (query: string) => boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: matches(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe('BlockSculpture under reduced motion', () => {
  let raf: ReturnType<typeof vi.fn>;
  let observers: number;

  beforeEach(() => {
    stubMedia((q) => q.includes('prefers-reduced-motion'));
    raf = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', raf);
    observers = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          observers++;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws the whole solved cube, posed and lit, from first paint', () => {
    const { container } = render(<BlockSculpture />);
    const cube = container.querySelector<HTMLElement>('[class*="cube"]:not([class*="cubie"])')!;
    const cubies = container.querySelectorAll<HTMLElement>('[class*="cubie"]');
    const faces = container.querySelectorAll<HTMLElement>('[class*="face"]');

    expect(cube.style.transform).toBe(toMatrix3d(worldRotation(0)));
    expect(cubies).toHaveLength(27);
    expect(faces).toHaveLength(27 * 6);
    for (const face of faces) expect(face.style.backgroundColor).not.toBe('');
  });

  it('never starts the loop', () => {
    render(<BlockSculpture />);
    expect(raf).not.toHaveBeenCalled();
    expect(observers).toBe(0);
  });

  it('does start it when motion is allowed — so the test above is not passing vacuously', () => {
    stubMedia(() => false);
    render(<BlockSculpture />);
    expect(raf).toHaveBeenCalled();
    expect(observers).toBe(1);
  });
});
