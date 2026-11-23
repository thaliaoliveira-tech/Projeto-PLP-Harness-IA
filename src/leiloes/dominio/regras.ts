import type {
  ComandoLeilao,
  Decisao,
  EstadoLeiloes,
  EventoLeilao,
  Leilao,
  LeilaoEstado,
  Processamento,
} from './tipos.js';

export const ESTADO_INICIAL: EstadoLeiloes = { leiloes: {} };

const iso = (ms: number): string => new Date(ms).toISOString();

export function valorMinimo(leilao: Leilao): number {
  return leilao.maiorLance
    ? leilao.maiorLance.valor + leilao.incrementoMinimo
    : leilao.lanceInicial;
}

export function paraLeilao({
  sequencia: _sequencia,
  ...leilao
}: LeilaoEstado): Leilao {
  return leilao;
}

/** Decide o que acontece com um comando num dado instante (ms). Função pura. */
export function decidir(
  estado: EstadoLeiloes,
  comando: ComandoLeilao,
  agora: number,
): Decisao {
  if (comando.tipo === 'CriarLeilao') {
    const evento: EventoLeilao = {
      sequencia: 1,
      tipo: 'LeilaoCriado',
      leilaoId: comando.id,
      ocorridoEm: iso(agora),
      dados: {
        titulo: comando.titulo,
        lanceInicial: comando.lanceInicial,
        incrementoMinimo: comando.incrementoMinimo,
        prorrogacaoSegundos: comando.prorrogacaoSegundos,
        encerraEm: iso(agora + comando.duracaoSegundos * 1000),
      },
    };
    return {
      eventos: [evento],
      resposta: { tipo: 'CRIADO', leilaoId: comando.id },
    };
  }

  const leilao = estado.leiloes[comando.leilaoId];
  if (!leilao) return { eventos: [], resposta: { tipo: 'NAO_ENCONTRADO' } };
  const encerraEmMs = Date.parse(leilao.encerraEm);

  if (comando.tipo === 'EncerrarLeilao') {
    if (leilao.status !== 'ABERTO' || leilao.encerraEm !== comando.prazo) {
      return { eventos: [], resposta: { tipo: 'OK' } };
    }
    return {
      eventos: [
        {
          sequencia: leilao.sequencia + 1,
          tipo: 'LeilaoEncerrado',
          leilaoId: leilao.id,
          ocorridoEm: iso(Math.max(agora, encerraEmMs)),
          dados: {
            vencedor: leilao.maiorLance?.participante ?? null,
            valor: leilao.maiorLance?.valor ?? null,
          },
        },
      ],
      resposta: { tipo: 'OK' },
    };
  }

  if (leilao.status === 'ENCERRADO' || agora >= encerraEmMs) {
    return { eventos: [], resposta: { tipo: 'LEILAO_ENCERRADO' } };
  }

  const { participante, valor } = comando;
  const ocorridoEm = iso(agora);
  const base = { leilaoId: leilao.id, ocorridoEm };

  const rejeitar = (
    motivo: 'PARTICIPANTE_JA_LIDERA' | 'VALOR_ABAIXO_DO_MINIMO',
    minimo?: number,
  ): Decisao => ({
    eventos: [
      {
        ...base,
        sequencia: leilao.sequencia + 1,
        tipo: 'LanceRejeitado',
        dados: { participante, valor, motivo },
      },
    ],
    resposta:
      minimo === undefined
        ? { tipo: 'LANCE_RECUSADO', motivo }
        : { tipo: 'LANCE_RECUSADO', motivo, valorMinimo: minimo },
  });

  if (leilao.maiorLance?.participante === participante)
    return rejeitar('PARTICIPANTE_JA_LIDERA');
  const minimo = valorMinimo(leilao);
  if (valor < minimo) return rejeitar('VALOR_ABAIXO_DO_MINIMO', minimo);

  const eventos: EventoLeilao[] = [
    {
      ...base,
      sequencia: leilao.sequencia + 1,
      tipo: 'LanceAceito',
      dados: { participante, valor },
    },
  ];
  const janela = leilao.prorrogacaoSegundos * 1000;
  if (janela > 0 && encerraEmMs - agora < janela) {
    eventos.push({
      ...base,
      sequencia: leilao.sequencia + 2,
      tipo: 'LeilaoProrrogado',
      dados: {
        encerraEmAnterior: leilao.encerraEm,
        encerraEm: iso(agora + janela),
      },
    });
  }
  return { eventos, resposta: { tipo: 'LANCE_ACEITO', leilaoId: leilao.id } };
}

/** Aplica um evento ao estado. Função pura (não altera o estado recebido). */
export function evoluir(
  estado: EstadoLeiloes,
  evento: EventoLeilao,
): EstadoLeiloes {
  const atual = estado.leiloes[evento.leilaoId];
  let proximo: LeilaoEstado;
  switch (evento.tipo) {
    case 'LeilaoCriado':
      proximo = {
        id: evento.leilaoId,
        ...evento.dados,
        status: 'ABERTO',
        maiorLance: null,
        totalLances: 0,
        vencedor: null,
        sequencia: evento.sequencia,
      };
      break;
    case 'LanceAceito':
      proximo = {
        ...atual!,
        maiorLance: { ...evento.dados, ocorridoEm: evento.ocorridoEm },
        totalLances: atual!.totalLances + 1,
        sequencia: evento.sequencia,
      };
      break;
    case 'LanceRejeitado':
      proximo = { ...atual!, sequencia: evento.sequencia };
      break;
    case 'LeilaoProrrogado':
      proximo = {
        ...atual!,
        encerraEm: evento.dados.encerraEm,
        sequencia: evento.sequencia,
      };
      break;
    case 'LeilaoEncerrado':
      proximo = {
        ...atual!,
        status: 'ENCERRADO',
        vencedor: evento.dados.vencedor,
        sequencia: evento.sequencia,
      };
      break;
  }
  return { leiloes: { ...estado.leiloes, [evento.leilaoId]: proximo } };
}

export function processar(
  estado: EstadoLeiloes,
  comando: ComandoLeilao,
  agora: number,
): Processamento {
  const decisao = decidir(estado, comando, agora);
  return { ...decisao, estado: decisao.eventos.reduce(evoluir, estado) };
}

/** Projeção do histórico: eventos de cada leilão, em ordem. */
export function registrar(
  historico: Readonly<Record<string, readonly EventoLeilao[]>>,
  evento: EventoLeilao,
): Readonly<Record<string, readonly EventoLeilao[]>> {
  return {
    ...historico,
    [evento.leilaoId]: [...(historico[evento.leilaoId] ?? []), evento],
  };
}
