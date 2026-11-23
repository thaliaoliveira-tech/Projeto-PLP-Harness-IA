import { Observable } from 'rxjs';
let contador = 0;
const cache = new Map<string, number>();
export class D {
  private total = 0;
  private readonly itens = new Map<string, number>();
  constructor(private readonly a$: Observable<number>) {
    this.total = 1;
    this.a$.subscribe((v) => { this.total = v; });
  }
  somar(): void { this.total += 1; }
  guardar(k: string): void { this.itens.set(k, 1); }
  incrementar(): number { contador++; cache.set('x', contador); return contador; }
  local(): number { const cache = new Map<string, number>(); cache.set('y', 1); return cache.size; }
}
