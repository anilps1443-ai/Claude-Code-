/**
 * Stacked quote cards: hovering one fans the stack open (offsets in vw, per the design).
 * Desktop / tablet only — on phones the cards are a plain column.
 */
import gsap from 'gsap';

const REST = [0, -22, -43, -65];
// per hovered card: x offsets for the 4 cards, + the duration of each move
const SPREAD = [
  { x: [0, -1, -25, -50], d: [0.9, 1.1, 1.0, 0.95] },
  { x: [0, -1, -25, -50], d: [0.9, 1.1, 1.0, 0.95] },
  { x: [0, -22, -43, -45], d: [0.9, 1.1, 1.0, 0.95] },
  { x: [0, -22, -43, -65], d: [0.9, 1.1, 1.0, 0.95] },
];
const PAPER = '#cdc6be';
const PAPER_DARK = '#beb5ab';

export function initCards() {
  const cards = [...document.querySelectorAll('.aw-block')];
  if (cards.length < 4) return;
  const mq = window.matchMedia('(min-width: 768px)');

  const setRest = () => cards.forEach((c, i) => gsap.set(c, { x: mq.matches ? `${REST[i]}vw` : 0, backgroundColor: PAPER }));
  setRest();
  mq.addEventListener('change', setRest);

  cards.forEach((card, hovered) => {
    card.addEventListener('mouseenter', () => {
      if (!mq.matches) return;
      cards.forEach((c, i) => {
        gsap.to(c, { x: `${SPREAD[hovered].x[i]}vw`, duration: SPREAD[hovered].d[i], ease: 'expo.out', overwrite: 'auto' });
        gsap.to(c, { backgroundColor: i === hovered ? PAPER_DARK : PAPER, duration: 0.5, ease: 'expo.out' });
      });
    });
    card.addEventListener('mouseleave', () => {
      if (!mq.matches) return;
      cards.forEach((c, i) => {
        gsap.to(c, { x: `${REST[i]}vw`, duration: [0.9, 0.95, 1.0, 1.1][i], ease: 'expo.out', overwrite: 'auto' });
        gsap.to(c, { backgroundColor: PAPER, duration: 0.5, ease: 'expo.out' });
      });
    });
  });
}
