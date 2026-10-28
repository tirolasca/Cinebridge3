import { SistemaRecomendacao, ConfiguracaoDeDecoradores } from '../../src/application/services/SistemaRecomendacao';
import { AdaptadoresExternos } from '../../src/application/ports/AdaptadoresExternos';
import { AdaptadorArmazenamento } from '../../src/application/ports/AdaptadorArmazenamento';
import { AdaptadorPagamento } from '../../src/application/ports/AdaptadorPagamento';
import { AdaptadorProfissional } from '../../src/application/ports/AdaptadorProfissional';
import { ArgumentoInvalidoError, ArquivoNaoEncontradoError } from '../../src/application/ports/ErrosDeIntegracao';
import { RepositorioProfissionais } from '../../src/application/services/RepositorioProfissionais';
import { SeletorDeFabricaProjeto } from '../../src/domain/factories/SeletorDeFabricaProjeto';
import { SujeitoDeEventos } from '../../src/domain/events/Observer';
import { EventoDominio, NomeEvento } from '../../src/domain/events/EventosDominio';
import { ProjetoDocumentario } from '../../src/domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../src/domain/entities/ProjetoAnimacao';
import { Profissional } from '../../src/domain/entities/Profissional';
import { PapelTecnico, TipoCaptacao } from '../../src/domain/entities/types';
import { PacoteServico } from '../../src/domain/servicos/PacoteServico';
import { ServicoAtomico } from '../../src/domain/servicos/ServicoAtomico';
import { ModoExecucao } from '../../src/domain/servicos/ServicoProjeto';
import { ArmazenamentoDeCache } from '../../src/domain/recomendacao/CacheDecorator';
import { AuditoriaEmMemoria } from '../../src/domain/recomendacao/AuditoriaDecorator';
import { EstatisticasDeCompressao } from '../../src/domain/recomendacao/CompressaoDecorator';
import {
  PilhaDeDecoradoresInvalidaError,
  criarConstrutorPadrao
} from '../../src/domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { RecomendacaoStrategy } from '../../src/domain/factories/TiposDeFabrica';
import { AdaptadorGoogleCloud } from '../../src/infrastructure/integracao/armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from '../../src/infrastructure/integracao/armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from '../../src/infrastructure/integracao/armazenamento/AdaptadorS3';
import { ArmazenamentoExterno } from '../../src/infrastructure/integracao/armazenamento/ArmazenamentoExterno';
import { ClienteGoogleCloudSimulado } from '../../src/infrastructure/integracao/armazenamento/ClienteGoogleCloudSimulado';
import { ClienteS3Simulado } from '../../src/infrastructure/integracao/armazenamento/ClienteS3Simulado';
import { AdaptadorPagSeguro } from '../../src/infrastructure/integracao/pagamento/AdaptadorPagSeguro';
import { AdaptadorPayPal } from '../../src/infrastructure/integracao/pagamento/AdaptadorPayPal';
import { AdaptadorStripe } from '../../src/infrastructure/integracao/pagamento/AdaptadorStripe';
import { GatewayPagamento } from '../../src/infrastructure/integracao/pagamento/GatewayPagamento';
import { PagSeguroSimulado } from '../../src/infrastructure/integracao/pagamento/PagSeguroSimulado';
import { StripeSimulado } from '../../src/infrastructure/integracao/pagamento/StripeSimulado';
import { AdaptadorIndeed } from '../../src/infrastructure/integracao/profissionais/AdaptadorIndeed';
import { AdaptadorInterno } from '../../src/infrastructure/integracao/profissionais/AdaptadorInterno';
import { AdaptadorLinkedIn } from '../../src/infrastructure/integracao/profissionais/AdaptadorLinkedIn';
import { ApiProfissionalExterna } from '../../src/infrastructure/integracao/profissionais/ApiProfissionalExterna';
import { LinkedInSimulado } from '../../src/infrastructure/integracao/profissionais/LinkedInSimulado';
import { criarAvaliacao, criarCompetencia, criarProfissional, dataFutura } from '../fixtures/builders';
import { completarRepositorio, criarAdaptadoresDeTeste } from '../fixtures/adaptadores';

// ----------------------------------------------------------------------------- apoio

const cadastroInterno: Profissional[] = [
  criarProfissional({ id: 'int-dir', nome: 'Diretora Interna', especialidadePrincipal: PapelTecnico.DIRETOR, avaliacoes: [criarAvaliacao(4.8)], competencias: [criarCompetencia('direcao_atores', 0.9)] }),
  criarProfissional({ id: 'int-edi', nome: 'Editor Interno', especialidadePrincipal: PapelTecnico.EDITOR, avaliacoes: [criarAvaliacao(4.5)] }),
  criarProfissional({ id: 'int-som', nome: 'Sonoplasta Interno', especialidadePrincipal: PapelTecnico.SONOPLASTA, avaliacoes: [criarAvaliacao(4.2)] })
];

const repositorioInterno = (): RepositorioProfissionais => ({
  buscarPorPapel: async (papel) => cadastroInterno.filter((p) => p.especialidadePrincipal === papel)
});

const profissionais: Array<{ nome: string; criar: () => AdaptadorProfissional; prefixoDeId: string }> = [
  { nome: 'interno', criar: () => new AdaptadorInterno(completarRepositorio(repositorioInterno())), prefixoDeId: 'int-' },
  { nome: 'linkedin', criar: () => new AdaptadorLinkedIn(new LinkedInSimulado()), prefixoDeId: 'linkedin:' },
  { nome: 'indeed', criar: () => new AdaptadorIndeed(new ApiProfissionalExterna()), prefixoDeId: 'indeed:' }
];

const armazenamentos: Array<{ nome: string; criar: () => AdaptadorArmazenamento }> = [
  { nome: 's3', criar: () => new AdaptadorS3(new ClienteS3Simulado(), 'midia') },
  { nome: 'google-cloud', criar: () => new AdaptadorGoogleCloud(new ClienteGoogleCloudSimulado(), 'midia') },
  { nome: 'local', criar: () => new AdaptadorLocal(new ArmazenamentoExterno()) }
];

const pagamentos: Array<{ nome: string; criar: () => AdaptadorPagamento }> = [
  { nome: 'stripe', criar: () => new AdaptadorStripe(new StripeSimulado()) },
  { nome: 'pagseguro', criar: () => new AdaptadorPagSeguro(new PagSeguroSimulado()) },
  { nome: 'paypal', criar: () => new AdaptadorPayPal(new GatewayPagamento()) }
];

function montar(opcoes: { adaptadores?: AdaptadoresExternos; pilhaPadrao?: string[]; semDecoradores?: boolean } = {}) {
  const cache = new ArmazenamentoDeCache();
  const auditoria = new AuditoriaEmMemoria();
  const compressao = new EstatisticasDeCompressao();
  const construtor = criarConstrutorPadrao({ cache, auditoria, compressao });
  const sujeito = new SujeitoDeEventos();
  const eventos: EventoDominio[] = [];
  sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventos.push(e); } });

  const decoradores: ConfiguracaoDeDecoradores | undefined = opcoes.semDecoradores
    ? undefined
    : { construtor, padrao: opcoes.pilhaPadrao ?? [] };
  const sistema = new SistemaRecomendacao(
    new SeletorDeFabricaProjeto(),
    sujeito,
    opcoes.adaptadores ?? criarAdaptadoresDeTeste(repositorioInterno()),
    decoradores
  );
  return { sistema, cache, auditoria, compressao, sujeito, eventos };
}

/**
 * Projeto → Pré-produção (paralelo: Direção) → Pós-produção (sequencial: Edição, Mixagem).
 * Custo 5000 + 4000 + 2000 = 11000; prazo 10 + (8 + 4) = 22 dias.
 */
const hierarquia = () =>
  new PacoteServico('Documentário', ModoExecucao.SEQUENCIAL, [
    new PacoteServico('Pré-produção', ModoExecucao.PARALELO, [new ServicoAtomico('Direção', PapelTecnico.DIRETOR, 5000, 10)]),
    new PacoteServico('Pós-produção', ModoExecucao.SEQUENCIAL, [
      new ServicoAtomico('Edição', PapelTecnico.EDITOR, 4000, 8),
      new ServicoAtomico('Mixagem', PapelTecnico.SONOPLASTA, 2000, 4)
    ])
  ]);

const documentario = (parcial: Partial<ConstructorParameters<typeof ProjetoDocumentario>[0]> = {}) =>
  new ProjetoDocumentario({
    titulo: 'Raízes', genero: 'doc', duracaoEstimadaMinutos: 50, orcamentoTotal: 20000,
    dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
    localizacao: { latitude: 0, longitude: 0, cidade: 'São Paulo' }, produtorId: 'produtor-1',
    tema: 'Cultura', entrevistados: ['A'], servicoPrincipal: hierarquia(),
    ...parcial
  });

beforeEach(() => {
  // O notificador de cada família escreve no console; silencia nos testes.
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// ----------------------------------------------------------------------------- Adapter

describe('Adapter — trocar de provedor sem alterar a lógica de negócio', () => {
  describe.each(profissionais)('cadastro de profissionais: $nome', ({ criar, prefixoDeId }) => {
    it('gera a mesma recomendação completa com a lógica de negócio de sempre', async () => {
      const { sistema } = montar({ adaptadores: { ...criarAdaptadoresDeTeste(), profissional: criar() } });

      const resultado = await sistema.gerarRecomendacao(documentario());

      expect(resultado.parcial).toBe(false);
      expect(resultado.itens.map((i) => i.papel).sort()).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
      expect(resultado.itens.every((i) => i.profissionalId.startsWith(prefixoDeId))).toBe(true);
    });
  });

  it('a troca em tempo de execução, com configurarAdaptadores(), muda a origem dos candidatos', async () => {
    const { sistema } = montar();
    const base = criarAdaptadoresDeTeste(repositorioInterno());

    sistema.configurarAdaptadores(base.armazenamento, base.pagamento, profissionais[0].criar());
    const interno = await sistema.gerarRecomendacao(documentario());
    expect(sistema.provedoresAtivos().profissional).toBe('interno');

    sistema.configurarAdaptadores(base.armazenamento, base.pagamento, profissionais[1].criar());
    const linkedin = await sistema.gerarRecomendacao(documentario());
    expect(sistema.provedoresAtivos().profissional).toBe('linkedin');

    expect(interno.itens.every((i) => i.profissionalId.startsWith('int-'))).toBe(true);
    expect(linkedin.itens.every((i) => i.profissionalId.startsWith('linkedin:'))).toBe(true);
  });

  it('uma falha no cadastro para um papel vira recomendação parcial, qualquer que seja o provedor', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const quebrado: AdaptadorProfissional = {
      provedor: 'quebrado',
      listarProfissionais: async ({ papel }) => {
        if (papel === PapelTecnico.EDITOR) throw new Error('indisponível');
        return cadastroInterno.filter((p) => p.especialidadePrincipal === papel);
      },
      detalharProfissional: async () => cadastroInterno[0],
      registrarAvaliacao: async () => undefined
    };
    const { sistema } = montar({ adaptadores: { ...criarAdaptadoresDeTeste(), profissional: quebrado } });

    const resultado = await sistema.gerarRecomendacao(documentario());

    expect(resultado.parcial).toBe(true);
    expect(resultado.itens.map((i) => i.papel).sort()).toEqual(['DIRETOR', 'SONOPLASTA']);
  });

  describe.each(armazenamentos)('armazenamento de arquivos: $nome', ({ nome, criar }) => {
    it('anexa, lista e recupera arquivos de um projeto, com os mesmos ids em qualquer provedor', async () => {
      const base = criarAdaptadoresDeTeste();
      const { sistema } = montar({ adaptadores: { ...base, armazenamento: criar() } });
      const roteiro = Buffer.from('FADE IN:');

      const id = await sistema.anexarArquivo('proj-1', 'roteiro.txt', roteiro, 'text/plain');
      await sistema.anexarArquivo('proj-1', 'storyboard.png', Buffer.from('png'));
      await sistema.anexarArquivo('proj-2', 'outro.txt', Buffer.from('x'));

      expect(sistema.provedoresAtivos().armazenamento).toBe(nome);
      expect(id).toBe('projetos/proj-1/roteiro.txt');
      expect(await sistema.listarArquivos('proj-1')).toEqual(['projetos/proj-1/roteiro.txt', 'projetos/proj-1/storyboard.png']);
      expect((await sistema.recuperarArquivo(id)).equals(roteiro)).toBe(true);
      await expect(sistema.recuperarArquivo('projetos/proj-1/nao-existe.txt')).rejects.toThrow(ArquivoNaoEncontradoError);
    });
  });

  it('rejeita identificadores de projeto que tentariam sair da pasta do projeto', async () => {
    const { sistema } = montar();
    await expect(sistema.anexarArquivo('../outro', 'a.txt', Buffer.from('x'))).rejects.toThrow(ArgumentoInvalidoError);
    await expect(sistema.listarArquivos('a/b')).rejects.toThrow(ArgumentoInvalidoError);
  });

  describe.each(pagamentos)('pagamentos: $nome', ({ nome, criar }) => {
    it('efetua, consulta e cancela pagamentos com o mesmo vocabulário em qualquer provedor', async () => {
      const base = criarAdaptadoresDeTeste();
      const { sistema } = montar({ adaptadores: { ...base, pagamento: criar() } });

      const id = await sistema.efetuarPagamento(2500, 'produtor-1', 'profissional-1');

      expect(sistema.provedoresAtivos().pagamento).toBe(nome);
      expect(await sistema.consultarPagamento(id)).toBe('CONFIRMADO');
      expect(await sistema.cancelarPagamento(id)).toBe(true);
      expect(await sistema.consultarPagamento(id)).toBe('CANCELADO');
    });
  });

  it('trocar os três adaptadores de uma vez isola os dados de cada provedor', async () => {
    const { sistema } = montar({
      adaptadores: { armazenamento: armazenamentos[0].criar(), pagamento: pagamentos[0].criar(), profissional: profissionais[0].criar() }
    });
    const arquivo = await sistema.anexarArquivo('proj-1', 'a.txt', Buffer.from('x'));
    const pagamento = await sistema.efetuarPagamento(10, 'p', 'q');

    sistema.configurarAdaptadores(armazenamentos[1].criar(), pagamentos[1].criar(), profissionais[1].criar());

    expect(sistema.provedoresAtivos()).toEqual({ armazenamento: 'google-cloud', pagamento: 'pagseguro', profissional: 'linkedin' });
    await expect(sistema.recuperarArquivo(arquivo)).rejects.toThrow(ArquivoNaoEncontradoError); // o arquivo está no S3, não no GCS
    await expect(sistema.consultarPagamento(pagamento)).rejects.toThrow(); // o pagamento é do Stripe
  });

  it('registra avaliações no cadastro em uso', async () => {
    const { sistema } = montar({ adaptadores: { ...criarAdaptadoresDeTeste(), profissional: new AdaptadorLinkedIn(new LinkedInSimulado()) } });
    await expect(sistema.registrarAvaliacao('linkedin:urn:li:person:1001', { nota: 5, projetoId: 'p' })).resolves.toBeUndefined();
  });
});

// ----------------------------------------------------------------------------- Composite

describe('Composite — hierarquia de serviços no fluxo de recomendação', () => {
  it('os papéis vêm das folhas da hierarquia, em qualquer profundidade, e o resultado traz custo e prazo planejados', async () => {
    const { sistema } = montar();

    const resultado = await sistema.gerarRecomendacao(documentario());

    expect(resultado.itens.map((i) => i.papel).sort()).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
    expect(resultado.custoPlanejado).toBe(11000);
    expect(resultado.prazoDias).toBe(22);
  });

  it('o projeto continua aceitando a lista simples de papéis (convertida em serviços atômicos)', async () => {
    const { sistema } = montar();
    const projeto = documentario({
      servicoPrincipal: undefined,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 0.6 }, { papel: PapelTecnico.EDITOR, pesoImportancia: 0.4 }]
    });

    const resultado = await sistema.gerarRecomendacao(projeto);

    expect(resultado.itens.map((i) => i.papel).sort()).toEqual(['DIRETOR', 'EDITOR']);
    expect(resultado.custoPlanejado).toBeCloseTo(20000, 6);
  });

  it.each([
    [
      'um serviço atômico com papel inexistente, em um subpacote',
      () => new PacoteServico('P', ModoExecucao.SEQUENCIAL, [new PacoteServico('Sub', ModoExecucao.SEQUENCIAL, [new ServicoAtomico('X', 'COZINHEIRO' as PapelTecnico, 100, 1)])]),
      {},
      /Estrutura de serviços inválida.*papel técnico inválido/
    ],
    [
      'prazo planejado maior que o tempo até a entrega',
      () => hierarquia(),
      { dataEntrega: dataFutura(10) },
      /prazo planejado \(22 dias\) excede/
    ],
    [
      'custo planejado maior que o orçamento',
      () => hierarquia(),
      { orcamentoTotal: 5000 },
      /custo planejado \(R\$ 11000\.00\) excede o orçamento/
    ],
    [
      'um pacote vazio dentro da hierarquia',
      () => new PacoteServico('P', ModoExecucao.SEQUENCIAL, [new ServicoAtomico('A', PapelTecnico.DIRETOR, 100, 1), new PacoteServico('Vazio')]),
      {},
      /não contém nenhum serviço/
    ]
  ])('rejeita %s, sem publicar o evento de recomendação', async (_descricao, servico, ajuste, mensagem) => {
    const { sistema, eventos } = montar();

    await expect(sistema.gerarRecomendacao(documentario({ servicoPrincipal: servico(), ...ajuste }))).rejects.toThrow(mensagem);
    expect(eventos).toHaveLength(0);
  });

  it('em modo paralelo, o mesmo trabalho cabe num prazo curto', async () => {
    const { sistema } = montar();
    const paralelo = new PacoteServico('Tudo junto', ModoExecucao.PARALELO, [...hierarquia().listarAtomicos()]);

    const resultado = await sistema.gerarRecomendacao(documentario({ dataEntrega: dataFutura(15), servicoPrincipal: paralelo }));

    expect(resultado.prazoDias).toBe(10);
  });
});

// ----------------------------------------------------------------------------- Decorator

describe('Decorator — pilha de decoradores definida em tempo de execução', () => {
  it('a pilha padrão (cache → auditoria) é aplicada e informada no resultado', async () => {
    const { sistema, cache, auditoria } = montar({ pilhaPadrao: ['cache', 'auditoria'] });

    const primeira = await sistema.gerarRecomendacao(documentario());
    const segunda = await sistema.gerarRecomendacao(documentario({ titulo: 'Outro título, mesmo trabalho' }));

    expect(primeira.decoradores).toEqual(['cache', 'auditoria']);
    expect(segunda.itens).toEqual(primeira.itens);
    expect(cache.estatisticas()).toEqual({ entradas: 1, acertos: 1, erros: 1 });
    expect(auditoria.total()).toBe(2); // a auditoria está por fora do cache e vê as duas chamadas
    expect(auditoria.ultimos(1)[0]).toMatchObject({ tipoProjeto: 'DOCUMENTARIO', candidatos: 3, membrosRecomendados: 3, sucesso: true });
  });

  it('a preferência do produtor substitui a pilha padrão nessa solicitação', async () => {
    const { sistema, cache, auditoria } = montar({ pilhaPadrao: ['cache', 'auditoria'] });

    const resultado = await sistema.gerarRecomendacao(documentario(), { decoradores: ['auditoria'] });

    expect(resultado.decoradores).toEqual(['auditoria']);
    expect(auditoria.total()).toBe(1);
    expect(cache.estatisticas().entradas).toBe(0);
  });

  it('uma lista vazia desliga todos os decoradores', async () => {
    const { sistema, auditoria } = montar({ pilhaPadrao: ['cache', 'auditoria'] });

    const resultado = await sistema.gerarRecomendacao(documentario(), { decoradores: [] });

    expect(resultado.decoradores).toEqual([]);
    expect(auditoria.total()).toBe(0);
  });

  it('a ordem da pilha muda o comportamento: auditoria por dentro do cache só vê o que passou pelo cache', async () => {
    const { sistema, auditoria } = montar();

    await sistema.gerarRecomendacao(documentario(), { decoradores: ['auditoria', 'cache'] });
    await sistema.gerarRecomendacao(documentario(), { decoradores: ['auditoria', 'cache'] });

    expect(auditoria.total()).toBe(1);
  });

  it('o mesmo SistemaRecomendacao aceita pilhas diferentes em chamadas seguidas, sem qualquer alteração', async () => {
    const { sistema, cache, auditoria, compressao } = montar();

    const a = await sistema.gerarRecomendacao(documentario(), { decoradores: ['cache'] });
    const b = await sistema.gerarRecomendacao(documentario(), { decoradores: ['cache', 'auditoria', 'compressao'] });
    const c = await sistema.gerarRecomendacao(documentario(), { decoradores: ['compressao', 'auditoria'] });

    expect([a.decoradores, b.decoradores, c.decoradores]).toEqual([['cache'], ['cache', 'auditoria', 'compressao'], ['compressao', 'auditoria']]);
    expect(a.itens).toEqual(b.itens);
    expect(b.itens).toEqual(c.itens);
    expect(cache.estatisticas().acertos).toBe(1); // a 2ª chamada reaproveitou o que a 1ª guardou
    expect(auditoria.total()).toBe(2);
    expect(compressao.resumo().chamadas).toBe(2);
  });

  it('a compressão registra os tamanhos da equipe recomendada', async () => {
    const { sistema, compressao } = montar();

    await sistema.gerarRecomendacao(documentario(), { decoradores: ['compressao'] });

    const resumo = compressao.resumo();
    expect(resumo.chamadas).toBe(1);
    expect(resumo.bytesOriginais).toBeGreaterThan(0);
    expect(resumo.bytesComprimidos).toBeGreaterThan(0);
  });

  it('o cache reduz o tempo de resposta de uma estratégia lenta, em requisições repetidas', async () => {
    const lenta: RecomendacaoStrategy = {
      recomendar: (projeto, candidatos) => {
        const fim = performance.now() + 30;
        while (performance.now() < fim) { /* cálculo caro simulado */ }
        return new Map(projeto.papeisRequeridos.flatMap((p) => {
          const escolhido = candidatos.find((c) => c.especialidadePrincipal === p.papel);
          return escolhido ? [[p.papel, escolhido] as [string, Profissional]] : [];
        }));
      }
    };
    const { sistema } = montar({ pilhaPadrao: ['cache'] });
    sistema.definirEstrategia(lenta);

    const t0 = performance.now();
    await sistema.gerarRecomendacao(documentario());
    const primeira = performance.now() - t0;
    const t1 = performance.now();
    await sistema.gerarRecomendacao(documentario());
    const segunda = performance.now() - t1;

    expect(primeira).toBeGreaterThanOrEqual(30);
    expect(segunda).toBeLessThan(primeira / 2);
  });

  it('projetos diferentes não compartilham resultados em cache', async () => {
    const { sistema, cache } = montar({ pilhaPadrao: ['cache'] });

    await sistema.gerarRecomendacao(documentario());
    await sistema.gerarRecomendacao(documentario({ orcamentoTotal: 50000 }));

    expect(cache.estatisticas()).toMatchObject({ entradas: 2, acertos: 0 });
  });

  it('rejeita um decorador desconhecido antes de qualquer consulta externa', async () => {
    const adaptadores = criarAdaptadoresDeTeste(repositorioInterno());
    const espiao = jest.spyOn(adaptadores.profissional, 'listarProfissionais');
    const { sistema, eventos, sujeito } = montar({ adaptadores });

    await expect(sistema.gerarRecomendacao(documentario(), { decoradores: ['cache', 'magia'] })).rejects.toThrow(PilhaDeDecoradoresInvalidaError);

    expect(espiao).not.toHaveBeenCalled();
    expect(eventos).toHaveLength(0);
    expect(sujeito.quantidadeDeObservadores()).toBe(1); // só o espião do teste: nada ficou inscrito
  });

  it('sem decoradores configurados no sistema, pedir um é erro', async () => {
    const { sistema } = montar({ semDecoradores: true });

    await expect(sistema.gerarRecomendacao(documentario(), { decoradores: ['cache'] })).rejects.toThrow(/Nenhum decorador/);
    await expect(sistema.gerarRecomendacao(documentario())).resolves.toMatchObject({ decoradores: [] });
    expect(sistema.decoradoresDisponiveis()).toEqual([]);
    expect(sistema.pilhaPadrao()).toEqual([]);
  });

  it('informa os decoradores disponíveis e a pilha padrão', () => {
    const { sistema } = montar({ pilhaPadrao: ['cache', 'auditoria'] });
    expect(sistema.decoradoresDisponiveis()).toEqual(['cache', 'auditoria', 'compressao']);
    expect(sistema.pilhaPadrao()).toEqual(['cache', 'auditoria']);
  });

  it('definirEstrategia() substitui o recomendador da família e pode ser desfeita', async () => {
    const primeiroDaLista: RecomendacaoStrategy = {
      recomendar: (_projeto, candidatos) =>
        new Map(candidatos.slice(0, 1).map((c) => [c.especialidadePrincipal, c] as [string, Profissional]))
    };
    const { sistema } = montar();

    sistema.definirEstrategia(primeiroDaLista);
    expect((await sistema.gerarRecomendacao(documentario())).itens).toHaveLength(1);

    sistema.definirEstrategia(undefined);
    expect((await sistema.gerarRecomendacao(documentario())).itens).toHaveLength(3);
  });

  it('os decoradores continuam valendo sobre uma estratégia definida explicitamente', async () => {
    const { sistema, auditoria } = montar();
    sistema.definirEstrategia({ recomendar: () => new Map() });

    await sistema.gerarRecomendacao(documentario(), { decoradores: ['auditoria'] });

    expect(auditoria.ultimos(1)[0].recomendador).toBe('Object');
  });

  it('executarRecomendacao() devolve a equipe (mapa papel → profissional) usando os adaptadores', async () => {
    const { sistema } = montar({ pilhaPadrao: ['auditoria'] });

    const equipe = await sistema.executarRecomendacao(documentario());

    expect(Array.from(equipe.keys()).sort()).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
    expect(equipe.get('DIRETOR')?.id).toBe('int-dir');
  });

  it('recomendar() com candidatos já em mãos também aplica a pilha padrão', async () => {
    const { sistema, auditoria } = montar({ pilhaPadrao: ['auditoria'] });

    const equipe = await sistema.recomendar(documentario(), cadastroInterno);

    expect(equipe.size).toBe(3);
    expect(auditoria.total()).toBe(1);
  });

  it('um projeto de outro tipo usa o recomendador da sua família, também decorado', async () => {
    const { sistema, auditoria } = montar({ pilhaPadrao: ['auditoria'] });
    const animacao = new ProjetoAnimacao({
      titulo: 'Anim', genero: 'anim', duracaoEstimadaMinutos: 10, orcamentoTotal: 10000,
      dataEntrega: dataFutura(60), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' }, produtorId: 'p',
      tecnicaAnimacao: '3D', softwarePrincipal: 'Blender',
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    await sistema.gerarRecomendacao(animacao);

    expect(auditoria.ultimos(1)[0]).toMatchObject({ tipoProjeto: 'ANIMACAO', recomendador: 'RecomendadorAnimacao' });
  });

  it('publica o evento de recomendação gerada, e o notificador da família não fica inscrito depois', async () => {
    const { sistema, eventos, sujeito } = montar({ pilhaPadrao: ['cache', 'auditoria'] });

    await sistema.gerarRecomendacao(documentario());

    expect(eventos.filter((e) => e.tipo === NomeEvento.RECOMENDACAO_GERADA)).toHaveLength(1);
    expect(sujeito.quantidadeDeObservadores()).toBe(1);
  });
});
