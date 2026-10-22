import type { Mode } from "./config.js";

const SINE_PERIOD = 24; // liczba punktów na pełny okres sinusoidy
const ENDLESS_SWEEP = 50; // długość przebiegu "range" przy --count 0

function raw(mode: Mode, i: number, count: number, min: number, max: number): number {
  const span = max - min;
  switch (mode) {
    case "random":
      return min + Math.random() * span;
    case "sine": {
      const noise = (Math.random() - 0.5) * span * 0.04;
      return min + span / 2 + span * 0.4 * Math.sin((2 * Math.PI * i) / SINE_PERIOD) + noise;
    }
    case "range": {
      const n = count > 0 ? count : ENDLESS_SWEEP;
      return n > 1 ? min + span * ((i % n) / (n - 1)) : min;
    }
  }
}

// Zaokrąglenie do 2 miejsc i przycięcie do [min, max], żeby serwer nie zwrócił 422 z winy generatora.
export function nextValue(mode: Mode, i: number, count: number, min: number, max: number): number {
  const rounded = Math.round(raw(mode, i, count, min, max) * 100) / 100;
  return Math.min(max, Math.max(min, rounded));
}