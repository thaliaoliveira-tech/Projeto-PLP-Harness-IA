import {
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EMPTY,
  Observable,
  Subject,
  concatMap,
  defer,
  filter,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import {
  type Comando,
  type Estado,
  type LeilaoEstado,
  type Passo,
  decidir,
  passoInicial,
} from './leiloes.dominio.js';
import type { EventoLeilao, Leilao, Notificacao } from './leiloes.types.js';

@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  private readonly comando$ = new Subject<Comando>();
  private readonly destruir$ = new Subject<void>();

  /**
   * Cada comando é reduzido, na ordem de chegada, sobre o estado imutável.
   * Esta é a única fonte de verdade; tudo o mais é derivado dela.
   */
  private readonly passo$: Observable<Passo> = this.comando$.pipe(
    scan((acc: Passo, cmd) => decidir(acc.estado, cmd), passoInicial),
    startWith(passoInicial),
    takeUntil(this.destruir$),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  private readonly estado$: Observable<Estado> = this.passo$.pipe(map((p) => p.estado));

  /** Encerramento automático: um temporizador por leilão, reiniciado a cada prorrogação. */
  private readonly encerramentos$: Observable<Comando> = this.passo$.pipe(
    concatMap((p) => from(p.eventos)),
    filter((e) => e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado'),
    groupBy((e) => e.leilaoId),
    mergeMap((grupo$) =>
      grupo$.pipe(
        switchMap((e) => {
          const encerraEm = e.dados.encerraEm as string;
          const alvo = Date.parse(encerraEm);
          return timer(Math.max(0, alvo - Date.now())).pipe(
            map((): Comando => ({
              tipo: 'ENCERRAR',
              correlacao: '',
              agora: Math.max(Date.now(), alvo),
              leilaoId: e.leilaoId,
              encerraEm,
            })),
          );
        }),
      ),
    ),
  );

  onModuleInit() {
    this.passo$.pipe(takeUntil(this.destruir$)).subscribe();
    this.encerramentos$
      .pipe(takeUntil(this.destruir$))
      .subscribe((cmd) => this.comando$.next(cmd));
  }

  onModuleDestroy() {
    this.destruir$.next();
    this.destruir$.complete();
  }

  criar(body: unknown): Observable<Leilao> {
    return this.executar({ tipo: 'CRIAR', correlacao: randomUUID(), agora: Date.now(), id: randomUUID(), body }) as Observable<Leilao>;
  }

  darLance(leilaoId: string, body: unknown): Observable<unknown> {
    return this.executar({ tipo: 'LANCE', correlacao: randomUUID(), agora: Date.now(), leilaoId, body });
  }

  listar(): Observable<Leilao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => s.ordem.map((id) => s.leiloes.get(id)!.leilao)),
    );
  }

  obter(id: string): Observable<Leilao> {
    return this.leilaoEstado(id).pipe(map((le) => le.leilao));
  }

  eventos(id: string): Observable<readonly EventoLeilao[]> {
    return this.leilaoEstado(id).pipe(map((le) => le.eventos));
  }

  /** Histórico + eventos novos; cada estado contém o histórico completo, então nada se perde. */
  stream(id: string): Observable<EventoLeilao> {
    return this.estado$.pipe(
      map((s) => {
        const le = s.leiloes.get(id);
        if (!le) throw new NotFoundException('Leilão não encontrado');
        return le.eventos;
      }),
      scan((acc, eventos) => ({ vistos: eventos.length, novos: eventos.slice(acc.vistos) }), {
        vistos: 0,
        novos: [] as readonly EventoLeilao[],
      }),
      concatMap((a) => from(a.novos)),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }

  notificacoesDe(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => s.notificacoes.get(nome) ?? []),
    );
  }

  private leilaoEstado(id: string): Observable<LeilaoEstado> {
    return this.estado$.pipe(
      take(1),
      map((s) => {
        const le = s.leiloes.get(id);
        if (!le) throw new NotFoundException('Leilão não encontrado');
        return le;
      }),
    );
  }

  /** Envia o comando só depois de assinar a resposta, correlacionada pelo id. */
  private executar(cmd: Comando): Observable<unknown> {
    const resposta$ = this.passo$.pipe(
      filter((p) => p.correlacao === cmd.correlacao),
      take(1),
      map((p) => {
        const r = p.resultado!;
        if (r.status >= 400) throw new HttpException(r.body as object, r.status);
        return r.body;
      }),
    );
    const enviar$ = defer(() => {
      this.comando$.next(cmd);
      return EMPTY;
    });
    return merge(resposta$, enviar$);
  }
}
