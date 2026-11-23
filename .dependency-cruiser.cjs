// Regras de dependência entre camadas e módulos (parte do harness).
// Documentação: docs/arquitetura.md (seção "Camadas e dependências permitidas").
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sem-ciclos',
      severity: 'error',
      comment:
        'Dependências circulares impedem entender quem reage a quem. Extraia o que é compartilhado para dominio/tipos.ts.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'dominio-puro',
      severity: 'error',
      comment:
        'A camada dominio/ só contém tipos e funções puras (decidir/evoluir/validar). Não pode importar NestJS, RxJS, Node nem as camadas aplicacao/ e http/.',
      from: { path: '^src/[^/]+/dominio/' },
      to: {
        pathNot: '^src/[^/]+/dominio/',
      },
    },
    {
      name: 'aplicacao-nao-conhece-http',
      severity: 'error',
      comment: 'A camada aplicacao/ (fluxos RxJS) não pode depender da camada http/ (controllers).',
      from: { path: '^src/[^/]+/aplicacao/' },
      to: { path: '^src/[^/]+/http/' },
    },
    {
      name: 'emissor-nao-conhece-observadores',
      severity: 'error',
      comment:
        'O módulo de leilões só publica eventos; quem reage (notificações...) assina o fluxo. Leilões nunca importam notificacoes/.',
      from: { path: '^src/leiloes/' },
      to: { path: '^src/notificacoes/' },
    },
    {
      name: 'observador-usa-api-publica',
      severity: 'error',
      comment:
        'Outros módulos só podem usar de leiloes/ o serviço de aplicação (fluxos) e os tipos de domínio, nunca os controllers.',
      from: { path: '^src/(?!leiloes/)[^/]+/' },
      to: { path: '^src/leiloes/http/' },
    },
    {
      name: 'sem-event-emitter',
      severity: 'error',
      comment: 'Eventos são modelados com RxJS. Não use EventEmitter (node:events) nem @nestjs/event-emitter.',
      from: { path: '^src/' },
      to: { path: '(^|/)node_modules/@nestjs/event-emitter/|^events$|^node:events$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(spec|e2e-spec)\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
