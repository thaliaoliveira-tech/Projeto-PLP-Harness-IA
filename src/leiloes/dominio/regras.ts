import type { Comando, Decisao, EstadoLeilao, Evento, Leilao } from './tipos.js';

const iso = (ms: number) => new Date(ms).toISOString();

export function paraLeilao({ sequencia: _sequencia, ...leilao }: EstadoLeilao): Leilao {
  return leilao;
}

export function valorMinimo(leilao: Leilao): number {
  return leilao.maiorLance ? leilao.maiorLance.valor + leilao.incrementoMinimo : leilao.lanceInicial;
}

/** Aplica um evento ao estado de um leilão (função pura). */
export function evoluir(estado: EstadoLeilao | undefined, evento: Evento): EstadoLeilao {
  const base = { ...(estado as EstadoLeilao), sequencia: evento.sequencia };
  switch (evento.tipo) {
    case 'LeilaoCriado':
      return {
        id: evento.leilaoId,
        ...evento.dados,
        status: 'ABERTO',
        maiorLance: null,
        totalLances: 0,
        vencedor: null,
        sequencia: evento.sequencia,
      };
    case 'LanceAceito':
      return {
        ...base,
        maiorLance: { participante: evento.dados.participante, valor: evento.dados.valor, ocorridoEm: evento.ocorridoEm },
        totalLances: base.totalLances + 1,
      };
    case 'LanceRejeitado':
      return base;
    case 'LeilaoProrrogado':
      return { ...base, encerraEm: evento.dados.encerraEm };
    case 'LeilaoEncerrado':
      return { ...base, status: 'ENCERRADO', vencedor: evento.dados.vencedor };
  }
}

function aplicar(estado: EstadoLeilao | undefined, eventos: Evento[]): EstadoLeilao {
  return eventos.reduce<EstadoLeilao | undefined>((e, ev) => evoluir(e, ev), estado) as EstadoLeilao;
}

/** Decide quais eventos um comando produz, dado o estado atual e o instante (ms). Função pura. */
export function decidir(estado: EstadoLeilao | undefined, comando: Comando, instante: number): Decisao {
  const ocorridoEm = iso(instante);

  if (comando.tipo === 'CriarLeilao') {
    const eventos: Evento[] = [
      {
        sequencia: 1,
        tipo: 'LeilaoCriado',
        leilaoId: comando.leilaoId,
        ocorridoEm,
        dados: {
          titulo: comando.titulo,
          lanceInicial: comando.lanceInicial,
          incrementoMinimo: comando.incrementoMinimo,
          prorrogacaoSegundos: comando.prorrogacaoSegundos,
          encerraEm: iso(instante + comando.duracaoSegundos * 1000),
        },
      },
    ];
    return { eventos, resultado: { tipo: 'CRIADO', leilao: paraLeilao(aplicar(undefined, eventos)) } };
  }

  if (!estado) return { eventos: [], resultado: { tipo: 'NAO_ENCONTRADO' } };
  let sequencia = estado.sequencia;
  const evento = <E extends Evento>(e: Omit<E, 'sequencia' | 'leilaoId'>) =>
    ({ ...e, sequencia: ++sequencia, leilaoId: estado.id }) as E;

  if (comando.tipo === 'EncerrarLeilao') {
    if (estado.status !== 'ABERTO' || estado.encerraEm !== comando.prazo) {
      return { eventos: [], resultado: { tipo: 'IGNORADO' } };
    }
    // o temporizador pode disparar ~1 ms antes do prazo: o evento nunca é anterior a ele
    const quando = iso(Math.max(instante, Date.parse(estado.encerraEm)));
    const eventos: Evento[] = [
      evento({
        tipo: 'LeilaoEncerrado',
        ocorridoEm: quando,
        dados: { vencedor: estado.maiorLance?.participante ?? null, valor: estado.maiorLance?.valor ?? null },
      }),
    ];
    return { eventos, resultado: { tipo: 'ENCERRADO', leilao: paraLeilao(aplicar(estado, eventos)) } };
  }

  // DarLance
  if (estado.status === 'ENCERRADO' || instante >= Date.parse(estado.encerraEm)) {
    return { eventos: [], resultado: { tipo: 'REJEITADO', motivo: 'LEILAO_ENCERRADO' } };
  }
  const { participante, valor } = comando;
  if (estado.maiorLance?.participante === participante) {
    const eventos: Evento[] = [
      evento({ tipo: 'LanceRejeitado', ocorridoEm, dados: { participante, valor, motivo: 'PARTICIPANTE_JA_LIDERA' } }),
    ];
    return { eventos, resultado: { tipo: 'REJEITADO', motivo: 'PARTICIPANTE_JA_LIDERA' } };
  }
  const minimo = valorMinimo(estado);
  if (valor < minimo) {
    const eventos: Evento[] = [
      evento({ tipo: 'LanceRejeitado', ocorridoEm, dados: { participante, valor, motivo: 'VALOR_ABAIXO_DO_MINIMO' } }),
    ];
    return { eventos, resultado: { tipo: 'REJEITADO', motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: minimo } };
  }

  const eventos: Evento[] = [evento({ tipo: 'LanceAceito', ocorridoEm, dados: { participante, valor } })];
  const janela = estado.prorrogacaoSegundos * 1000;
  const encerraEm = Date.parse(estado.encerraEm);
  if (janela > 0 && encerraEm - instante < janela) {
    eventos.push(
      evento({
        tipo: 'LeilaoProrrogado',
        ocorridoEm,
        dados: { encerraEmAnterior: estado.encerraEm, encerraEm: iso(instante + janela) },
      }),
    );
  }
  return { eventos, resultado: { tipo: 'ACEITO', leilao: paraLeilao(aplicar(estado, eventos)) } };
}
