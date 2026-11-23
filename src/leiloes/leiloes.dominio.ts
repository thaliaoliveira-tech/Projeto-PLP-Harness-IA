import type { EventoLeilao, Leilao, Notificacao, TipoEvento } from './leiloes.types.js';

/** Estado do domínio: imutável, evolui apenas por `decidir` (função pura). */
export interface LeilaoEstado {
  readonly leilao: Leilao;
  readonly eventos: readonly EventoLeilao[];
}

export interface Estado {
  readonly leiloes: ReadonlyMap<string, LeilaoEstado>;
  readonly ordem: readonly string[];
  readonly notificacoes: ReadonlyMap<string, readonly Notificacao[]>;
}

export const estadoInicial: Estado = {
  leiloes: new Map(),
  ordem: [],
  notificacoes: new Map(),
};

export type Comando =
  | { tipo: 'CRIAR'; correlacao: string; agora: number; id: string; body: unknown }
  | { tipo: 'LANCE'; correlacao: string; agora: number; leilaoId: string; body: unknown }
  | { tipo: 'ENCERRAR'; correlacao: string; agora: number; leilaoId: string; encerraEm: string };

export interface Resultado {
  status: number;
  body: unknown;
}

export interface Passo {
  estado: Estado;
  correlacao: string;
  resultado: Resultado | null;
  /** Eventos produzidos por este comando. */
  eventos: readonly EventoLeilao[];
}

export const passoInicial: Passo = {
  estado: estadoInicial,
  correlacao: '',
  resultado: null,
  eventos: [],
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const iso = (ms: number) => new Date(ms).toISOString();

const invalido: Resultado = { status: 400, body: { message: 'Corpo inválido' } };
const naoEncontrado: Resultado = { status: 404, body: { message: 'Leilão não encontrado' } };

type Def = [TipoEvento, Record<string, unknown>];

function anexar(
  le: LeilaoEstado,
  leilao: Leilao,
  defs: Def[],
  ocorridoEm: string,
): { le: LeilaoEstado; novos: EventoLeilao[] } {
  const novos = defs.map(([tipo, dados], i) => ({
    sequencia: le.eventos.length + i + 1,
    tipo,
    leilaoId: leilao.id,
    ocorridoEm,
    dados,
  }));
  return { le: { leilao, eventos: [...le.eventos, ...novos] }, novos };
}

function comLeilao(estado: Estado, le: LeilaoEstado): Estado {
  return { ...estado, leiloes: new Map(estado.leiloes).set(le.leilao.id, le) };
}

function comNotificacao(estado: Estado, nome: string, n: Notificacao): Estado {
  const atuais = estado.notificacoes.get(nome) ?? [];
  return { ...estado, notificacoes: new Map(estado.notificacoes).set(nome, [...atuais, n]) };
}

function passo(estado: Estado, cmd: Comando, resultado: Resultado | null, eventos: EventoLeilao[] = []): Passo {
  return { estado, correlacao: cmd.correlacao, resultado, eventos };
}

function encerrar(estado: Estado, le: LeilaoEstado, agora: number) {
  const l = le.leilao;
  const vencedor = l.maiorLance?.participante ?? null;
  const fechado: Leilao = { ...l, status: 'ENCERRADO', vencedor };
  const ts = iso(agora);
  const r = anexar(le, fechado, [['LeilaoEncerrado', { vencedor, valor: l.maiorLance?.valor ?? null }]], ts);
  let novo = comLeilao(estado, r.le);
  if (l.maiorLance) {
    novo = comNotificacao(novo, l.maiorLance.participante, {
      tipo: 'LEILAO_VENCIDO',
      leilaoId: l.id,
      titulo: l.titulo,
      valor: l.maiorLance.valor,
      ocorridoEm: ts,
    });
  }
  return { estado: novo, eventos: r.novos };
}

export function decidir(estado: Estado, cmd: Comando): Passo {
  switch (cmd.tipo) {
    case 'CRIAR':
      return criar(estado, cmd);
    case 'LANCE':
      return lance(estado, cmd);
    case 'ENCERRAR': {
      const le = estado.leiloes.get(cmd.leilaoId);
      // Temporizador obsoleto (leilão já encerrado ou prorrogado): ignora.
      if (!le || le.leilao.status !== 'ABERTO' || le.leilao.encerraEm !== cmd.encerraEm) {
        return passo(estado, cmd, null);
      }
      const r = encerrar(estado, le, cmd.agora);
      return passo(r.estado, cmd, null, r.eventos);
    }
  }
}

function criar(estado: Estado, cmd: Extract<Comando, { tipo: 'CRIAR' }>): Passo {
  const b = cmd.body as Record<string, unknown> | null;
  if (typeof b !== 'object' || b === null) return passo(estado, cmd, invalido);
  const prorrog = b.prorrogacaoSegundos === undefined ? 0 : b.prorrogacaoSegundos;
  if (
    !isStr(b.titulo) ||
    !isNum(b.lanceInicial) ||
    b.lanceInicial <= 0 ||
    !isNum(b.incrementoMinimo) ||
    b.incrementoMinimo <= 0 ||
    !isInt(b.duracaoSegundos, 1, 86400) ||
    !isInt(prorrog, 0, 3600)
  ) {
    return passo(estado, cmd, invalido);
  }
  const leilao: Leilao = {
    id: cmd.id,
    titulo: b.titulo,
    lanceInicial: b.lanceInicial,
    incrementoMinimo: b.incrementoMinimo,
    prorrogacaoSegundos: prorrog,
    status: 'ABERTO',
    maiorLance: null,
    totalLances: 0,
    encerraEm: iso(cmd.agora + b.duracaoSegundos * 1000),
    vencedor: null,
  };
  const r = anexar({ leilao, eventos: [] }, leilao, [
    [
      'LeilaoCriado',
      {
        titulo: leilao.titulo,
        lanceInicial: leilao.lanceInicial,
        incrementoMinimo: leilao.incrementoMinimo,
        prorrogacaoSegundos: leilao.prorrogacaoSegundos,
        encerraEm: leilao.encerraEm,
      },
    ],
  ], iso(cmd.agora));
  const novo: Estado = { ...comLeilao(estado, r.le), ordem: [...estado.ordem, leilao.id] };
  return passo(novo, cmd, { status: 201, body: leilao }, r.novos);
}

function lance(estado: Estado, cmd: Extract<Comando, { tipo: 'LANCE' }>): Passo {
  const le = estado.leiloes.get(cmd.leilaoId);
  if (!le) return passo(estado, cmd, naoEncontrado);
  const b = cmd.body as Record<string, unknown> | null;
  if (typeof b !== 'object' || b === null || !isStr(b.participante) || !isNum(b.valor) || b.valor <= 0) {
    return passo(estado, cmd, invalido);
  }
  const { participante, valor } = b;
  const l = le.leilao;
  const ts = iso(cmd.agora);

  if (l.status === 'ENCERRADO' || cmd.agora >= Date.parse(l.encerraEm)) {
    const r = l.status === 'ABERTO' ? encerrar(estado, le, cmd.agora) : { estado, eventos: [] };
    return passo(r.estado, cmd, { status: 409, body: { aceito: false, motivo: 'LEILAO_ENCERRADO' } }, r.eventos);
  }

  const rejeitar = (motivo: string, extra: Record<string, unknown> = {}): Passo => {
    const r = anexar(le, l, [['LanceRejeitado', { participante, valor, motivo }]], ts);
    return passo(comLeilao(estado, r.le), cmd, { status: 422, body: { aceito: false, motivo, ...extra } }, r.novos);
  };
  if (l.maiorLance?.participante === participante) return rejeitar('PARTICIPANTE_JA_LIDERA');
  const valorMinimo = l.maiorLance ? l.maiorLance.valor + l.incrementoMinimo : l.lanceInicial;
  if (valor < valorMinimo) return rejeitar('VALOR_ABAIXO_DO_MINIMO', { valorMinimo });

  const anterior = l.maiorLance;
  let atualizado: Leilao = {
    ...l,
    maiorLance: { participante, valor, ocorridoEm: ts },
    totalLances: l.totalLances + 1,
  };
  const defs: Def[] = [['LanceAceito', { participante, valor }]];
  const fimMs = Date.parse(l.encerraEm);
  if (l.prorrogacaoSegundos > 0 && fimMs - cmd.agora < l.prorrogacaoSegundos * 1000) {
    atualizado = { ...atualizado, encerraEm: iso(cmd.agora + l.prorrogacaoSegundos * 1000) };
    defs.push(['LeilaoProrrogado', { encerraEmAnterior: l.encerraEm, encerraEm: atualizado.encerraEm }]);
  }
  const r = anexar(le, atualizado, defs, ts);
  let novo = comLeilao(estado, r.le);
  if (anterior) {
    novo = comNotificacao(novo, anterior.participante, {
      tipo: 'LANCE_SUPERADO',
      leilaoId: l.id,
      titulo: l.titulo,
      valorAnterior: anterior.valor,
      novoValor: valor,
      ocorridoEm: ts,
    });
  }
  return passo(novo, cmd, { status: 201, body: { aceito: true, leilao: atualizado } }, r.novos);
}
