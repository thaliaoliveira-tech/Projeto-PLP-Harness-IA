// Regras de negócio puras: decidir (comando -> eventos) e evoluir (evento -> estado).
// Nenhuma função daqui lê relógio, gera id ou faz I/O: tudo chega por parâmetro.
import type {
  Comando,
  CriarLeilao,
  DarLance,
  EncerrarLeilao,
  Entrada,
  Estado,
  EstadoLeilao,
  EventoLeilao,
  Leilao,
  MotivoRecusa,
  Processamento,
  Resultado,
} from './tipos.js';

export const ESTADO_INICIAL: Estado = { leiloes: new Map() };

export const PROCESSAMENTO_INICIAL: Processamento = {
  entradaId: null,
  estado: ESTADO_INICIAL,
  eventos: [],
  resultado: { tipo: 'SemEfeito' },
};

const iso = (ms: number): string => new Date(ms).toISOString();

export function valorMinimo(leilao: Leilao): number {
  return leilao.maiorLance === null
    ? leilao.lanceInicial
    : leilao.maiorLance.valor + leilao.incrementoMinimo;
}

interface Decisao {
  readonly eventos: readonly EventoLeilao[];
  readonly resultado: Resultado;
}

/** Decide quais eventos um comando produz, dado o estado atual e o instante. */
export function decidir(
  estado: Estado,
  comando: Comando,
  instante: number,
): Decisao {
  switch (comando.tipo) {
    case 'CriarLeilao':
      return decidirCriacao(estado, comando, instante);
    case 'DarLance':
      return decidirLance(estado, comando, instante);
    case 'EncerrarLeilao':
      return decidirEncerramento(estado, comando, instante);
  }
}

function decidirCriacao(
  estado: Estado,
  cmd: CriarLeilao,
  instante: number,
): Decisao {
  if (estado.leiloes.has(cmd.leilaoId)) {
    return { eventos: [], resultado: { tipo: 'SemEfeito' } };
  }
  const evento: EventoLeilao = {
    sequencia: 1,
    tipo: 'LeilaoCriado',
    leilaoId: cmd.leilaoId,
    ocorridoEm: iso(instante),
    dados: {
      titulo: cmd.titulo,
      lanceInicial: cmd.lanceInicial,
      incrementoMinimo: cmd.incrementoMinimo,
      prorrogacaoSegundos: cmd.prorrogacaoSegundos,
      encerraEm: iso(instante + cmd.duracaoSegundos * 1000),
    },
  };
  return { eventos: [evento], resultado: { tipo: 'SemEfeito' } };
}

function venceu(leilao: Leilao, instante: number): boolean {
  return leilao.status === 'ABERTO' && instante >= Date.parse(leilao.encerraEm);
}

function eventoDeEncerramento(
  atual: EstadoLeilao,
  instante: number,
): EventoLeilao {
  const { leilao } = atual;
  return {
    sequencia: atual.eventos.length + 1,
    tipo: 'LeilaoEncerrado',
    leilaoId: leilao.id,
    ocorridoEm: iso(instante),
    dados: {
      vencedor: leilao.maiorLance?.participante ?? null,
      valor: leilao.maiorLance?.valor ?? null,
    },
  };
}

function decidirEncerramento(
  estado: Estado,
  cmd: EncerrarLeilao,
  instante: number,
): Decisao {
  const atual = estado.leiloes.get(cmd.leilaoId);
  if (atual === undefined) {
    return { eventos: [], resultado: { tipo: 'NaoEncontrado' } };
  }
  // O temporizador agendou este comando para `cmd.prazo`. Se o prazo mudou (prorrogação), um novo
  // temporizador já foi agendado e este comando não tem efeito. Decidir pelo prazo agendado (e não
  // só por Date.now()) evita depender da precisão do temporizador, que pode disparar ~1 ms antes.
  if (atual.leilao.status !== 'ABERTO' || atual.leilao.encerraEm !== cmd.prazo) {
    return { eventos: [], resultado: { tipo: 'SemEfeito' } };
  }
  return {
    eventos: [eventoDeEncerramento(atual, Math.max(instante, Date.parse(cmd.prazo)))],
    resultado: { tipo: 'SemEfeito' },
  };
}

function recusa(motivo: MotivoRecusa, valorMinimoAceito?: number): Resultado {
  return valorMinimoAceito === undefined
    ? { tipo: 'LanceRecusado', motivo }
    : { tipo: 'LanceRecusado', motivo, valorMinimo: valorMinimoAceito };
}

function decidirLance(
  estado: Estado,
  cmd: DarLance,
  instante: number,
): Decisao {
  const atual = estado.leiloes.get(cmd.leilaoId);
  if (atual === undefined) {
    return { eventos: [], resultado: { tipo: 'NaoEncontrado' } };
  }
  const { leilao } = atual;

  // Regra 3: encerrado (ou prazo vencido, ainda não processado pelo temporizador).
  if (leilao.status === 'ENCERRADO') {
    return { eventos: [], resultado: recusa('LEILAO_ENCERRADO') };
  }
  if (venceu(leilao, instante)) {
    return {
      eventos: [eventoDeEncerramento(atual, instante)],
      resultado: recusa('LEILAO_ENCERRADO'),
    };
  }

  const proximaSequencia = atual.eventos.length + 1;
  const base = {
    sequencia: proximaSequencia,
    leilaoId: leilao.id,
    ocorridoEm: iso(instante),
  };

  // Regras 4 e 5: recusas que geram o evento LanceRejeitado.
  const minimo = valorMinimo(leilao);
  const motivo: MotivoRecusa | null =
    leilao.maiorLance?.participante === cmd.participante
      ? 'PARTICIPANTE_JA_LIDERA'
      : cmd.valor < minimo
        ? 'VALOR_ABAIXO_DO_MINIMO'
        : null;
  if (motivo !== null) {
    return {
      eventos: [
        {
          ...base,
          tipo: 'LanceRejeitado',
          dados: { participante: cmd.participante, valor: cmd.valor, motivo },
        },
      ],
      resultado: recusa(
        motivo,
        motivo === 'VALOR_ABAIXO_DO_MINIMO' ? minimo : undefined,
      ),
    };
  }

  // Regra 6: aceito (com possível prorrogação anti-sniping).
  const aceito: EventoLeilao = {
    ...base,
    tipo: 'LanceAceito',
    dados: { participante: cmd.participante, valor: cmd.valor },
  };
  const janelaMs = leilao.prorrogacaoSegundos * 1000;
  const restanteMs = Date.parse(leilao.encerraEm) - instante;
  const prorrogar = janelaMs > 0 && restanteMs < janelaMs;
  const eventos: EventoLeilao[] = prorrogar
    ? [
        aceito,
        {
          sequencia: proximaSequencia + 1,
          tipo: 'LeilaoProrrogado',
          leilaoId: leilao.id,
          ocorridoEm: iso(instante),
          dados: {
            encerraEmAnterior: leilao.encerraEm,
            encerraEm: iso(instante + janelaMs),
          },
        },
      ]
    : [aceito];
  return { eventos, resultado: { tipo: 'SemEfeito' } };
}

/** Aplica um evento ao estado, devolvendo um novo estado (imutável). */
export function evoluir(estado: Estado, evento: EventoLeilao): Estado {
  const anterior = estado.leiloes.get(evento.leilaoId);
  const leilao = evoluirLeilao(anterior?.leilao, evento);
  const leiloes = new Map(estado.leiloes);
  leiloes.set(evento.leilaoId, {
    leilao,
    eventos: [...(anterior?.eventos ?? []), evento],
  });
  return { leiloes };
}

function evoluirLeilao(leilao: Leilao | undefined, evento: EventoLeilao): Leilao {
  if (evento.tipo === 'LeilaoCriado') {
    return {
      id: evento.leilaoId,
      titulo: evento.dados.titulo,
      lanceInicial: evento.dados.lanceInicial,
      incrementoMinimo: evento.dados.incrementoMinimo,
      prorrogacaoSegundos: evento.dados.prorrogacaoSegundos,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: evento.dados.encerraEm,
      vencedor: null,
    };
  }
  if (leilao === undefined) {
    throw new Error(`evento ${evento.tipo} para leilão inexistente`);
  }
  switch (evento.tipo) {
    case 'LanceAceito':
      return {
        ...leilao,
        maiorLance: {
          participante: evento.dados.participante,
          valor: evento.dados.valor,
          ocorridoEm: evento.ocorridoEm,
        },
        totalLances: leilao.totalLances + 1,
      };
    case 'LanceRejeitado':
      return leilao;
    case 'LeilaoProrrogado':
      return { ...leilao, encerraEm: evento.dados.encerraEm };
    case 'LeilaoEncerrado':
      return { ...leilao, status: 'ENCERRADO', vencedor: evento.dados.vencedor };
  }
}

/** Passo completo do processador: decide, evolui o estado e monta o resultado. */
export function processar(estado: Estado, entrada: Entrada): Processamento {
  const decisao = decidir(estado, entrada.comando, entrada.instante);
  const novoEstado = decisao.eventos.reduce(evoluir, estado);
  return {
    entradaId: entrada.id,
    estado: novoEstado,
    eventos: decisao.eventos,
    resultado: completarResultado(decisao.resultado, entrada.comando, novoEstado),
  };
}

function completarResultado(
  resultado: Resultado,
  comando: Comando,
  estado: Estado,
): Resultado {
  if (resultado.tipo !== 'SemEfeito') return resultado;
  const leilao = estado.leiloes.get(comando.leilaoId)?.leilao;
  if (leilao === undefined) return resultado;
  if (comando.tipo === 'CriarLeilao') return { tipo: 'Criado', leilao };
  if (comando.tipo === 'DarLance') return { tipo: 'LanceAceito', leilao };
  return resultado;
}
