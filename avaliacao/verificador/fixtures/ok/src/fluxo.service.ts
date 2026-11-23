import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, map, scan, shareReplay, startWith, switchMap, takeUntil, timer } from 'rxjs';
type Evento = { id: string; prazo: number };
@Injectable()
export class FluxoService implements OnModuleInit, OnModuleDestroy {
  private readonly entrada$ = new Subject<Evento>();
  private readonly destruir$ = new Subject<void>();
  readonly eventos$: Observable<Evento> = this.entrada$.asObservable();
  readonly lista$ = this.eventos$.pipe(scan((acc: Evento[], e) => [...acc, e], []), startWith([]), shareReplay(1));
  private conexao?: { unsubscribe(): void };
  constructor() { this.conexao = undefined; }
  onModuleInit(): void {
    this.conexao = this.lista$.pipe(takeUntil(this.destruir$)).subscribe();
    this.eventos$.pipe(switchMap((e) => timer(e.prazo)), map(() => 1), takeUntil(this.destruir$)).subscribe();
  }
  onModuleDestroy(): void { this.destruir$.next(); this.destruir$.complete(); }
  publicar(e: Evento): void { this.entrada$.next(e); }
  copia(): Map<string, number> { const m = new Map<string, number>(); m.set('a', 1); return m; }
}
