/**
 * Loader: the whole page starts as a small card below the fold, rises, then spins up
 * (two full turns) to full size. ~5 s total; scrolling is locked until it lands.
 * Timings/easings follow the original interaction spec (expo in-out).
 */
import gsap from 'gsap';

export function playIntro(stage, loco) {
  const root = document.documentElement;
  const vw = window.innerWidth / 100;

  root.classList.add('no-scroll');
  if (loco) loco.stop();

  gsap.set(stage, { y: 25 * vw, scale: 0.4, rotation: 720, transformOrigin: `50% ${43.5 * vw}px` });
  root.classList.remove('intro');

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(stage, { clearProps: 'transform,transformOrigin' });
        root.classList.remove('no-scroll');
        if (loco) { loco.update(); loco.start(); }
        resolve();
      },
    });
    tl.to(stage, { y: -18 * vw, duration: 2, ease: 'expo.inOut' }, 0.5)
      .to(stage, { scale: 1, rotation: 0, duration: 2, ease: 'expo.inOut' }, 3)
      .to(stage, { y: 0, duration: 1.5, ease: 'expo.inOut' }, 3);
  });
}
