import type {
  Comando,
  Decisao,
  EstadoLeiloes,
  EventoLeilao,
  Leilao,
  LeilaoEstado,
  NovoLance,
} from './tipos.js';

export const ESTADO_INICIAL: EstadoLeiloes = { leiloes: new Map() };

const iso = (instante: number): string => new Date(instante).toISOString();

export function valorMinimo(leilao: Leilao): number {
  return leilao.maiorLance === null
    ? leilao.lanceInicial
    : leilao.maiorLance.valor + leilao.incrementoMinimo;
}

/** Remove o que é interno (contador de sequência) do leilão. */
export function paraLeilao(estado: LeilaoEstado): Leilao {
  const { ultimaSequencia: _, ...leilao } = estado;
  return leilao;
}

/** Eventos de um leilão recebem sequência consecutiva a partir da última já emitida. */
function numerar(
  ultima: number,
  leilaoId: string,
  ocorridoEm: string,
  itens: Omit<EventoLeilao, 'sequencia' | 'leilaoId' | 'ocorridoEm'>[],
): EventoLeilao[] {
  return itens.map(
    (item, i) =>
      ({
        ...item,
        sequencia: ultima + i + 1,
        leilaoId,
        ocorridoEm,
      }) as EventoLeilao,
  );
}

function decidirLance(
  leilao: LeilaoEstado,
  { participante, valor }: NovoLance,
  instante: number,
): Decisao {
  const ocorridoEm = iso(instante);
  const encerraEm = Date.parse(leilao.encerraEm);
  if (leilao.status === 'ENCERRADO' || instante >= encerraEm) {
    return {
      eventos: [],
      resultado: { tipo: 'LANCE_RECUSADO', motivo: 'LEILAO_ENCERRADO' },
    };
  }
  if (leilao.maiorLance?.participante === participante) {
    return {
      eventos: numerar(leilao.ultimaSequencia, leilao.id, ocorridoEm, [
        {
          tipo: 'LanceRejeitado',
          dados: { participante, valor, motivo: 'PARTICIPANTE_JA_LIDERA' },
        },
      ]),
      resultado: { tipo: 'LANCE_RECUSADO', motivo: 'PARTICIPANTE_JA_LIDERA' },
    };
  }
  const minimo = valorMinimo(leilao);
  if (valor < minimo) {
    return {
      eventos: numerar(leilao.ultimaSequencia, leilao.id, ocorridoEm, [
        {
          tipo: 'LanceRejeitado',
          dados: { participante, valor, motivo: 'VALOR_ABAIXO_DO_MINIMO' },
        },
      ]),
      resultado: {
        tipo: 'LANCE_RECUSADO',
        motivo: 'VALOR_ABAIXO_DO_MINIMO',
        valorMinimo: minimo,
      },
    };
  }
  const janela = leilao.prorrogacaoSegundos * 1000;
  const prorroga = janela > 0 && encerraEm - instante < janela;
  const itens: Omit<EventoLeilao, 'sequencia' | 'leilaoId' | 'ocorridoEm'>[] = [
    { tipo: 'LanceAceito', dados: { participante, valor } },
  ];
  if (prorroga) {
    itens.push({
      tipo: 'LeilaoProrrogado',
      dados: {
        encerraEmAnterior: leilao.encerraEm,
        encerraEm: iso(instante + janela),
      },
    });
  }
  return {
    eventos: numerar(leilao.ultimaSequencia, leilao.id, ocorridoEm, itens),
    resultado: { tipo: 'LANCE_ACEITO', leilaoId: leilao.id },
  };
}

/** Decide, sem efeitos colaterais, quais eventos um comando produz no instante dado (ms desde a época). */
export function decidir(
  estado: EstadoLeiloes,
  comando: Comando,
  instante: number,
): Decisao {
  switch (comando.tipo) {
    case 'CriarLeilao': {
      const {
        titulo,
        lanceInicial,
        incrementoMinimo,
        prorrogacaoSegundos,
        duracaoSegundos,
      } = comando.dados;
      const encerraEm = iso(instante + duracaoSegundos * 1000);
      return {
        eventos: numerar(0, comando.id, iso(instante), [
          {
            tipo: 'LeilaoCriado',
            dados: {
              titulo,
              lanceInicial,
              incrementoMinimo,
              prorrogacaoSegundos,
              encerraEm,
            },
          },
        ]),
        resultado: { tipo: 'LEILAO_CRIADO', leilaoId: comando.id },
      };
    }
    case 'DarLance': {
      const leilao = estado.leiloes.get(comando.leilaoId);
      if (!leilao)
        return { eventos: [], resultado: { tipo: 'LEILAO_INEXISTENTE' } };
      return decidirLance(leilao, comando.dados, instante);
    }
    case 'EncerrarLeilao': {
      const leilao = estado.leiloes.get(comando.leilaoId);
      // O prazo agendado pode ter sido substituído por uma prorrogação: então este comando é obsoleto.
      if (
        !leilao ||
        leilao.status === 'ENCERRADO' ||
        leilao.encerraEm !== comando.prazo
      ) {
        return { eventos: [], resultado: { tipo: 'IGNORADO' } };
      }
      // O temporizador pode disparar ~1 ms antes do relógio alcançar o prazo.
      const quando = Math.max(instante, Date.parse(leilao.encerraEm));
      return {
        eventos: numerar(leilao.ultimaSequencia, leilao.id, iso(quando), [
          {
            tipo: 'LeilaoEncerrado',
            dados: {
              vencedor: leilao.maiorLance?.participante ?? null,
              valor: leilao.maiorLance?.valor ?? null,
            },
          },
        ]),
        resultado: { tipo: 'IGNORADO' },
      };
    }
  }
}

/** Aplica um evento ao estado, devolvendo um novo estado. */
export function evoluir(
  estado: EstadoLeiloes,
  evento: EventoLeilao,
): EstadoLeiloes {
  if (evento.tipo === 'LeilaoCriado') {
    const novo: LeilaoEstado = {
      id: evento.leilaoId,
      ...evento.dados,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      vencedor: null,
      ultimaSequencia: evento.sequencia,
    };
    return { leiloes: new Map(estado.leiloes).set(novo.id, novo) };
  }
  const atual = estado.leiloes.get(evento.leilaoId);
  if (!atual) return estado;
  const base: LeilaoEstado = { ...atual, ultimaSequencia: evento.sequencia };
  let novo: LeilaoEstado;
  switch (evento.tipo) {
    case 'LanceAceito':
      novo = {
        ...base,
        maiorLance: { ...evento.dados, ocorridoEm: evento.ocorridoEm },
        totalLances: atual.totalLances + 1,
      };
      break;
    case 'LeilaoProrrogado':
      novo = { ...base, encerraEm: evento.dados.encerraEm };
      break;
    case 'LeilaoEncerrado':
      novo = { ...base, status: 'ENCERRADO', vencedor: evento.dados.vencedor };
      break;
    default:
      novo = base;
  }
  return { leiloes: new Map(estado.leiloes).set(novo.id, novo) };
}
