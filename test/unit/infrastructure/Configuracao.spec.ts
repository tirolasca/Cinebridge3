import { DataSource } from 'typeorm';
import {
  ConfiguracaoDeIntegracoes,
  PROVEDORES_DE_ARMAZENAMENTO,
  PROVEDORES_DE_PAGAMENTO,
  PROVEDORES_DE_PROFISSIONAIS,
  criarAdaptadores,
  lerConfiguracaoDeIntegracoes
} from '../../../src/infrastructure/integracao/AdaptadoresFactory';
import { lerPilhaPadrao, montarContainer } from '../../../src/infrastructure/http/container';
import { PilhaDeDecoradoresInvalidaError } from '../../../src/domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { completarRepositorio } from '../../fixtures/adaptadores';

describe('lerConfiguracaoDeIntegracoes', () => {
  it('sem variáveis de ambiente, usa armazenamento local, Stripe e cadastro interno', () => {
    expect(lerConfiguracaoDeIntegracoes({})).toEqual({ armazenamento: 'local', pagamento: 'stripe', profissional: 'interno' });
  });

  it('lê os provedores das variáveis, ignorando maiúsculas e espaços', () => {
    expect(
      lerConfiguracaoDeIntegracoes({
        ADAPTADOR_ARMAZENAMENTO: ' S3 ',
        ADAPTADOR_PAGAMENTO: 'PagSeguro',
        ADAPTADOR_PROFISSIONAL: 'LINKEDIN'
      })
    ).toEqual({ armazenamento: 's3', pagamento: 'pagseguro', profissional: 'linkedin' });
  });

  it('valor em branco volta ao padrão', () => {
    expect(lerConfiguracaoDeIntegracoes({ ADAPTADOR_PAGAMENTO: '   ' }).pagamento).toBe('stripe');
  });

  it.each([
    ['ADAPTADOR_ARMAZENAMENTO', 'dropbox', /local, s3, google-cloud/],
    ['ADAPTADOR_PAGAMENTO', 'bitcoin', /stripe, pagseguro, paypal/],
    ['ADAPTADOR_PROFISSIONAL', 'orkut', /interno, linkedin, indeed/]
  ])('rejeita %s=%s, listando os valores aceitos', (variavel, valor, aceitos) => {
    expect(() => lerConfiguracaoDeIntegracoes({ [variavel]: valor })).toThrow(aceitos);
    expect(() => lerConfiguracaoDeIntegracoes({ [variavel]: valor })).toThrow(variavel);
  });
});

describe('criarAdaptadores — todas as combinações de provedores', () => {
  const repositorio = completarRepositorio({ buscarPorPapel: async () => [] });
  const combinacoes: ConfiguracaoDeIntegracoes[] = PROVEDORES_DE_ARMAZENAMENTO.flatMap((armazenamento) =>
    PROVEDORES_DE_PAGAMENTO.flatMap((pagamento) =>
      PROVEDORES_DE_PROFISSIONAIS.map((profissional) => ({ armazenamento, pagamento, profissional }))
    )
  );

  it('cobre as 27 combinações', () => {
    expect(combinacoes).toHaveLength(27);
  });

  it.each(combinacoes)('monta os adaptadores de %j', (configuracao) => {
    const adaptadores = criarAdaptadores(configuracao, { repositorioProfissionais: repositorio });

    expect(adaptadores.armazenamento.provedor).toBe(configuracao.armazenamento);
    expect(adaptadores.pagamento.provedor).toBe(configuracao.pagamento);
    expect(adaptadores.profissional.provedor).toBe(configuracao.profissional);
  });
});

describe('lerPilhaPadrao', () => {
  it('o padrão é cache e auditoria', () => {
    expect(lerPilhaPadrao({})).toEqual(['cache', 'auditoria']);
  });

  it('lê a lista da variável, na ordem dada e sem espaços sobrando', () => {
    expect(lerPilhaPadrao({ RECOMENDACAO_DECORADORES: ' auditoria , cache,compressao ' })).toEqual(['auditoria', 'cache', 'compressao']);
  });

  it('"none" desliga todos os decoradores, e lista vazia também', () => {
    expect(lerPilhaPadrao({ RECOMENDACAO_DECORADORES: 'NONE' })).toEqual([]);
    expect(lerPilhaPadrao({ RECOMENDACAO_DECORADORES: '' })).toEqual([]);
  });
});

describe('montarContainer — configuração por variáveis de ambiente', () => {
  const dataSource = {} as DataSource; // a montagem só guarda a referência; nada é consultado

  it('monta o sistema com os provedores e a pilha configurados', () => {
    const container = montarContainer(dataSource, {
      ADAPTADOR_ARMAZENAMENTO: 'google-cloud',
      ADAPTADOR_PAGAMENTO: 'paypal',
      ADAPTADOR_PROFISSIONAL: 'indeed',
      RECOMENDACAO_DECORADORES: 'compressao,auditoria'
    });

    expect(container.sistemaRecomendacao.provedoresAtivos()).toEqual({
      armazenamento: 'google-cloud', pagamento: 'paypal', profissional: 'indeed'
    });
    expect(container.sistemaRecomendacao.pilhaPadrao()).toEqual(['compressao', 'auditoria']);
  });

  it('usa os padrões quando nada é configurado', () => {
    const container = montarContainer(dataSource, {});

    expect(container.sistemaRecomendacao.provedoresAtivos()).toEqual({ armazenamento: 'local', pagamento: 'stripe', profissional: 'interno' });
    expect(container.sistemaRecomendacao.pilhaPadrao()).toEqual(['cache', 'auditoria']);
  });

  it('falha já na montagem se um decorador configurado não existe', () => {
    expect(() => montarContainer(dataSource, { RECOMENDACAO_DECORADORES: 'cache,magia' })).toThrow(PilhaDeDecoradoresInvalidaError);
  });

  it('falha já na montagem se um provedor configurado não existe', () => {
    expect(() => montarContainer(dataSource, { ADAPTADOR_PAGAMENTO: 'bitcoin' })).toThrow(/ADAPTADOR_PAGAMENTO/);
  });

  it('o estado dos decoradores é exposto no container, para o diagnóstico', () => {
    const container = montarContainer(dataSource, {});
    expect(container.cacheDeRecomendacao.estatisticas()).toEqual({ entradas: 0, acertos: 0, erros: 0 });
    expect(container.auditoriaDeRecomendacao.total()).toBe(0);
    expect(container.compressaoDeRecomendacao.resumo().chamadas).toBe(0);
  });
});
