import { setTimeout as esperar } from 'node:timers/promises';
export function agendar(f: () => void): void {
  setTimeout(f, 10);
  setInterval(f, 10);
  void esperar;
}
