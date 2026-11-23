import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
export const barramento = new Subject<number>();
export class C {
  readonly publico$ = new Subject<number>();
  private readonly privado$ = new BehaviorSubject(0);
  protected readonly protegido$ = new ReplaySubject<number>();
  readonly #oculto$ = new Subject<number>();
  constructor(public readonly injetado$: Subject<number>, private readonly ok$: Subject<number>) {}
  obter(): Subject<number> { return this.ok$; }
  usar(): void { this.privado$.next(1); this.protegido$.next(1); this.#oculto$.next(1); }
}
