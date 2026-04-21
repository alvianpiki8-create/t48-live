import confetti from "canvas-confetti";

export const celebrateCoinTopup = () => {
  const end = Date.now() + 1200;
  const colors = ["#fbbf24", "#f59e0b", "#fde68a", "#fff"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

export const celebrateShowPurchase = () => {
  confetti({
    particleCount: 140,
    spread: 90,
    origin: { y: 0.6 },
    colors: ["#3b82f6", "#60a5fa", "#93c5fd", "#fff", "#fbbf24"],
  });
  setTimeout(() => {
    confetti({ particleCount: 80, spread: 120, origin: { y: 0.7 }, colors: ["#3b82f6", "#fbbf24", "#fff"] });
  }, 250);
};
