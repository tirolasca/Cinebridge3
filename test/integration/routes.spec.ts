import Fastify, { FastifyInstance } from 'fastify';
import { registrarRotas } from '../../src/infrastructure/http/routes';
import { EstrategiaRecomendacaoFactory } from '../../src/domain/strategies/EstrategiaRecomendacaoFactory';
import { OrquestradorPadrao } from '../../src/application/orchestrator/OrquestradorPadrao';
import { OrquestradorReavaliacao } from '../../src/application/orchestrator/OrquestradorReavaliacao';
import { SujeitoDeEventos } from '../../src/domain/events/Observer';
import { MotorDeRecomendacao } from '../../src/application/services/MotorDeRecomendacao';
import { ServicoDeConvites } from '../../src/application/services/ServicoDeConvites';
import { SistemaRecomendacao } from '../../src/application/services/SistemaRecomendacao';
import { RepositorioProfissionais } from '../../src/application/services/RepositorioProfissionais';
import { SeletorDeFabricaProjeto } from '../../src/domain/factories/SeletorDeFabricaProjeto';
import { Profissional } from '../../src/domain/entities/Profissional';
import { PapelTecnico } from '../../src/domain/entities/types';
import { criarProfissional, criarCompetencia, dataFutura } from '../fixtures/builders';
import { criarAdaptadoresDeTeste } from '../fixtures/adaptadores';
import { Container } from '../../src/infrastructure/http/container';
import { AdaptadoresExternos } from '../../src/application/ports/AdaptadoresExternos';
import { ArmazenamentoDeCache } from '../../src/domain/recomendacao/CacheDecorator';
import { AuditoriaEmMemoria } from '../../src/domain/recomendacao/AuditoriaDecorator';
import { EstatisticasDeCompressao } from '../../src/domain/recomendacao/CompressaoDecorator';
import { criarConstrutorPadrao } from '../../src/domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { AdaptadorS3 } from '../../src/infrastructure/integracao/armazenamento/AdaptadorS3';
import { AdaptadorGoogleCloud } from '../../src/infrastructure/integracao/armazenamento/AdaptadorGoogleCloud';
import { ClienteS3Simulado } from '../../src/infrastructure/integracao/armazenamento/ClienteS3Simulado';
import { ClienteGoogleCloudSimulado } from '../../src/infrastructure/integracao/armazenamento/ClienteGoogleCloudSimulado';
import { AdaptadorPagSeguro } from '../../src/infrastructure/integracao/pagamento/AdaptadorPagSeguro';
import { AdaptadorStripe } from '../../src/infrastructure/integracao/pagamento/AdaptadorStripe';
import { PagSeguroSimulado } from '../../src/infrastructure/integracao/pagamento/PagSeguroSimulado';
import { StripeSimulado } from '../../src/infrastructure/integracao/pagamento/StripeSimulado';
import { AdaptadorLinkedIn } from '../../src/infrastructure/integracao/profissionais/AdaptadorLinkedIn';
import { LinkedInSimulado } from '../../src/infrastructure/integracao/profissionais/LinkedInSimulado';

class RepositorioEmMemoria implements RepositorioProfissionais {
  constructor(private readonly dados: Map<PapelTecnico, Profissional[]>) {}
  async buscarPorPapel(papel: PapelTecnico): Promise<Profissional[]> {
    return this.dados.get(papel) ?? [];
  }
}

interface OpcoesDoContainerDeTeste {
  /** Pilha de decoradores padrão (por omissão, nenhuma). */
  pilhaPadrao?: string[];
  /** Adaptadores a usar no lugar dos padrões de teste. */
  adaptadores?: (repositorio: RepositorioProfissionais) => AdaptadoresExternos;
}

function montarContainerDeTeste(opcoes: OpcoesDoContainerDeTeste = {}): Container {
  const sujeitoDeEventos = new SujeitoDeEventos();
  const dados = new Map<PapelTecnico, Profissional[]>([
    [
      PapelTecnico.DIRETOR,
      [
        criarProfissional({
          nome: 'Diretor Teste',
          especialidadePrincipal: PapelTecnico.DIRETOR,
          competencias: [criarCompetencia('direcao_atores', 0.9)]
        })
      ]
    ],
    [
      PapelTecnico.EDITOR,
      [
        criarProfissional({
          nome: 'Editor Teste',
          especialidadePrincipal: PapelTecnico.EDITOR,
          competencias: [criarCompetencia('edicao_avancada', 0.9)]
        })
      ]
    ],
    [
      PapelTecnico.ESPECIALISTA_VFX,
      [
        criarProfissional({
          nome: 'VFX Teste',
          especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
          competencias: [criarCompetencia('modelagem_3d', 0.9)]
        })
      ]
    ]
  ]);
  const repositorioProfissionais = new RepositorioEmMemoria(dados);
  const estrategiaFactory = new EstrategiaRecomendacaoFactory();
  const orquestradorPadrao = new OrquestradorPadrao();
  const orquestradorReavaliacao = new OrquestradorReavaliacao();

  const motorDeRecomendacao = new MotorDeRecomendacao(
    estrategiaFactory,
    orquestradorPadrao,
    repositorioProfissionais,
    sujeitoDeEventos
  );
  const motorDeReavaliacao = new MotorDeRecomendacao(
    estrategiaFactory,
    orquestradorReavaliacao,
    repositorioProfissionais,
    sujeitoDeEventos
  );
  const servicoDeConvites = new ServicoDeConvites(sujeitoDeEventos);
  const seletorDeFabrica = new SeletorDeFabricaProjeto();
  const cacheDeRecomendacao = new ArmazenamentoDeCache();
  const auditoriaDeRecomendacao = new AuditoriaEmMemoria();
  const compressaoDeRecomendacao = new EstatisticasDeCompressao();
  const sistemaRecomendacao = new SistemaRecomendacao(
    seletorDeFabrica,
    sujeitoDeEventos,
    (opcoes.adaptadores ?? criarAdaptadoresDeTeste)(repositorioProfissionais),
    { construtor: criarConstrutorPadrao({ cache: cacheDeRecomendacao, auditoria: auditoriaDeRecomendacao, compressao: compressaoDeRecomendacao }), padrao: opcoes.pilhaPadrao ?? [] }
  );

  return {
    sujeitoDeEventos,
    repositorioProfissionais,
    estrategiaFactory,
    motorDeRecomendacao,
    motorDeReavaliacao,
    servicoDeConvites,
    seletorDeFabrica,
    sistemaRecomendacao,
    cacheDeRecomendacao,
    auditoriaDeRecomendacao,
    compressaoDeRecomendacao
  };
}

describe('Rotas HTTP — POST /projetos/recomendacao', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // O notificador de cada família escreve no console; silencia nos testes.
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    app = Fastify();
    await registrarRotas(app, montarContainerDeTeste());
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('GET /health responde status ok', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok' });
  });

  it('GET /estrategias lista as estratégias disponíveis', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/estrategias' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().disponiveis.sort()).toEqual(
      ['filtragem_colaborativa', 'orcamento_reduzido', 'similaridade_cosseno'].sort()
    );
  });

  it('GET /tipos-projeto lista os tipos de projeto suportados', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/tipos-projeto' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().disponiveis.sort()).toEqual(['ANIMACAO', 'DOCUMENTARIO', 'PUBLICITARIO']);
  });

  const base = {
    titulo: 'Projeto de teste',
    genero: 'drama',
    duracaoEstimadaMinutos: 15,
    orcamentoTotal: 20000,
    dataEntrega: dataFutura(120).toISOString(),
    tipoCaptacao: 'FICCAO',
    localizacao: { latitude: -23.5, longitude: -46.6, cidade: 'São Paulo' },
    produtorId: 'produtor-1'
  };
  const papeisDiretorEditor = [
    { papel: 'DIRETOR', pesoImportancia: 0.5 },
    { papel: 'EDITOR', pesoImportancia: 0.5 }
  ];
  const documentario = {
    ...base,
    tipoProjeto: 'DOCUMENTARIO',
    papeisRequeridos: papeisDiretorEditor,
    tema: 'Cultura popular',
    entrevistados: ['Mestre Zé']
  };
  const post = (payload: unknown) => app.inject({ method: 'POST', url: '/projetos/recomendacao', payload: payload as object });

  it('POST /projetos/recomendacao (DOCUMENTARIO) retorna a equipe recomendada pela família', async () => {
    const resposta = await post(documentario);

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.tipoProjeto).toBe('DOCUMENTARIO');
    expect(corpo.parcial).toBe(false);
    expect(corpo.itens.map((i: { nome: string }) => i.nome).sort()).toEqual(['Diretor Teste', 'Editor Teste']);
  });

  it('POST /projetos/recomendacao (ANIMACAO) usa os campos específicos de animação', async () => {
    const resposta = await post({
      ...base,
      tipoProjeto: 'ANIMACAO',
      tipoCaptacao: 'ANIMACAO',
      papeisRequeridos: [{ papel: 'ESPECIALISTA_VFX', pesoImportancia: 1 }],
      tecnicaAnimacao: '3D',
      softwarePrincipal: 'Blender'
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().itens[0].nome).toBe('VFX Teste');
  });

  it('POST /projetos/recomendacao (PUBLICITARIO) usa os campos específicos publicitários', async () => {
    const resposta = await post({
      ...base,
      tipoProjeto: 'PUBLICITARIO',
      papeisRequeridos: papeisDiretorEditor,
      marcaAnunciante: 'Marca X',
      dataVeiculacao: dataFutura(150).toISOString()
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().tipoProjeto).toBe('PUBLICITARIO');
    expect(resposta.json().itens).toHaveLength(2);
  });

  it('POST /projetos/recomendacao retorna 422 quando o projeto não atende às regras do seu tipo', async () => {
    const semTema = await post({ ...documentario, tema: undefined });
    expect(semTema.statusCode).toBe(422);
    expect(semTema.json().detalhe).toMatch(/DOCUMENTARIO/);

    const veiculacaoAntesDaEntrega = await post({
      ...base,
      tipoProjeto: 'PUBLICITARIO',
      papeisRequeridos: papeisDiretorEditor,
      marcaAnunciante: 'Marca X',
      dataVeiculacao: dataFutura(30).toISOString()
    });
    expect(veiculacaoAntesDaEntrega.statusCode).toBe(422);
  });

  it('POST /projetos/recomendacao ignora campos específicos de outros tipos', async () => {
    // Campos de animação enviados num documentário válido não interferem.
    const resposta = await post({ ...documentario, tecnicaAnimacao: '3D', marcaAnunciante: 'Marca X' });
    expect(resposta.statusCode).toBe(201);
  });

  it('POST /projetos/recomendacao retorna 422 quando o prazo de entrega já passou', async () => {
    const resposta = await post({ ...documentario, dataEntrega: '2020-01-01T00:00:00.000Z' });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().detalhe).toMatch(/Data de entrega/);
  });

  it('POST /projetos/recomendacao retorna 400 sem o tipoProjeto ou com um tipo inexistente', async () => {
    const { tipoProjeto: _omitido, ...semTipo } = documentario;
    expect((await post(semTipo)).statusCode).toBe(400);
    expect((await post({ ...documentario, tipoProjeto: 'REALIDADE_VIRTUAL' })).statusCode).toBe(400);
  });

  it('POST /projetos/recomendacao retorna 400 para payload inválido (schema Fastify)', async () => {
    const resposta = await post({ titulo: 'Sem os demais campos obrigatórios' });

    expect(resposta.statusCode).toBe(400);
  });
});


// ===========================================================================
// Composite, Decorator e Adapter pela API
// ===========================================================================

describe('Rotas HTTP — hierarquia de serviços, decoradores e integrações', () => {
  let app: FastifyInstance;

  async function iniciar(opcoes: OpcoesDoContainerDeTeste = {}) {
    app = Fastify();
    await registrarRotas(app, montarContainerDeTeste(opcoes));
    await app.ready();
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  const entrega = () => dataFutura(120).toISOString();
  const base = () => ({
    titulo: 'Raízes', genero: 'doc', duracaoEstimadaMinutos: 50, orcamentoTotal: 20000, dataEntrega: entrega(),
    tipoCaptacao: 'DOCUMENTARIO', tipoProjeto: 'DOCUMENTARIO', produtorId: 'produtor-1',
    localizacao: { latitude: -23.5, longitude: -46.6, cidade: 'São Paulo' },
    tema: 'Cultura', entrevistados: ['Mestre Zé']
  });
  const servicoPrincipal = () => ({
    tipo: 'PACOTE', nome: 'Documentário', modoExecucao: 'SEQUENCIAL',
    servicos: [
      { tipo: 'PACOTE', nome: 'Pré-produção', modoExecucao: 'PARALELO', servicos: [{ tipo: 'ATOMICO', nome: 'Direção', papel: 'DIRETOR', custo: 5000, prazoDias: 10 }] },
      { tipo: 'PACOTE', nome: 'Pós-produção', servicos: [{ tipo: 'ATOMICO', nome: 'Edição', papel: 'EDITOR', custo: 4000, prazoDias: 8 }] }
    ]
  });
  const post = (url: string, payload?: unknown) => app.inject({ method: 'POST', url, payload: payload as object });

  describe('POST /projetos/recomendacao com servicoPrincipal (Composite)', () => {
    it('aceita a hierarquia de serviços e devolve custo e prazo planejados', async () => {
      await iniciar();

      const resposta = await post('/projetos/recomendacao', { ...base(), servicoPrincipal: servicoPrincipal() });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.itens.map((i: { nome: string }) => i.nome).sort()).toEqual(['Diretor Teste', 'Editor Teste']);
      expect(corpo.custoPlanejado).toBe(9000);
      expect(corpo.prazoDias).toBe(18);
      expect(corpo.decoradores).toEqual([]);
    });

    it('retorna 422 quando a hierarquia tem um serviço inválido, em qualquer profundidade', async () => {
      await iniciar();
      const invalido = servicoPrincipal();
      (invalido.servicos[1].servicos![0] as { papel: string }).papel = 'COZINHEIRO';

      const resposta = await post('/projetos/recomendacao', { ...base(), servicoPrincipal: invalido });

      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().detalhe).toMatch(/Documentário › Pós-produção › Serviço "Edição": papel técnico inválido/);
    });

    it('retorna 400 para tipo de serviço desconhecido na hierarquia (o schema só admite ATOMICO ou PACOTE)', async () => {
      await iniciar();
      const resposta = await post('/projetos/recomendacao', {
        ...base(), servicoPrincipal: { tipo: 'PACOTE', nome: 'P', servicos: [{ tipo: 'ATOMICO', nome: 'A', papel: 'DIRETOR', custo: 1, prazoDias: 1 }, { tipo: 'COMBO', nome: 'X' }] }
      });
      expect(resposta.statusCode).toBe(400);
    });

    it('retorna 422 para um pacote sem a lista de serviços', async () => {
      await iniciar();
      const resposta = await post('/projetos/recomendacao', { ...base(), servicoPrincipal: { tipo: 'PACOTE', nome: 'P' } });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().erro).toMatch(/Hierarquia de serviços inválida/);
    });

    it('retorna 422 quando o prazo planejado não cabe até a entrega', async () => {
      await iniciar();
      const resposta = await post('/projetos/recomendacao', { ...base(), dataEntrega: dataFutura(5).toISOString(), servicoPrincipal: servicoPrincipal() });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().detalhe).toMatch(/prazo planejado/);
    });

    it('retorna 400 quando não há nem servicoPrincipal nem papeisRequeridos', async () => {
      await iniciar();
      expect((await post('/projetos/recomendacao', base())).statusCode).toBe(400);
    });
  });

  describe('decoradores (preferência do produtor e pilha padrão)', () => {
    const corpoComPapeis = () => ({ ...base(), papeisRequeridos: [{ papel: 'DIRETOR', pesoImportancia: 0.5 }, { papel: 'EDITOR', pesoImportancia: 0.5 }] });

    it('aplica a pilha pedida e informa o efeito no diagnóstico (cache, auditoria e compressão)', async () => {
      await iniciar();

      const primeira = await post('/projetos/recomendacao', { ...corpoComPapeis(), decoradores: ['cache', 'auditoria', 'compressao'] });
      const segunda = await post('/projetos/recomendacao', { ...corpoComPapeis(), titulo: 'Outro título', decoradores: ['cache', 'auditoria', 'compressao'] });

      expect(primeira.json().decoradores).toEqual(['cache', 'auditoria', 'compressao']);
      expect(segunda.json().itens).toEqual(primeira.json().itens);

      const diagnostico = (await app.inject({ method: 'GET', url: '/recomendacao/diagnostico' })).json();
      expect(diagnostico.cache).toEqual({ entradas: 1, acertos: 1, erros: 1 });
      expect(diagnostico.auditoria.total).toBe(2);
      expect(diagnostico.auditoria.ultimos[0]).toMatchObject({ tipoProjeto: 'DOCUMENTARIO', sucesso: true, membrosRecomendados: 2 });
      expect(diagnostico.compressao.chamadas).toBe(2);
    });

    it('usa a pilha padrão do serviço quando a requisição não escolhe uma', async () => {
      await iniciar({ pilhaPadrao: ['auditoria'] });

      const resposta = await post('/projetos/recomendacao', corpoComPapeis());

      expect(resposta.json().decoradores).toEqual(['auditoria']);
      expect((await app.inject({ method: 'GET', url: '/recomendacao/diagnostico' })).json().auditoria.total).toBe(1);
    });

    it('retorna 400 para um decorador desconhecido, informando os disponíveis', async () => {
      await iniciar();

      const resposta = await post('/projetos/recomendacao', { ...corpoComPapeis(), decoradores: ['magia'] });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json().detalhe).toMatch(/magia.*Disponíveis: cache, auditoria, compressao/);
    });

    it('o diagnóstico começa zerado', async () => {
      await iniciar();
      const diagnostico = (await app.inject({ method: 'GET', url: '/recomendacao/diagnostico' })).json();

      expect(diagnostico).toMatchObject({
        pilhaPadrao: [], decoradoresDisponiveis: ['cache', 'auditoria', 'compressao'],
        cache: { entradas: 0, acertos: 0, erros: 0 }, auditoria: { total: 0, ultimos: [] }
      });
    });
  });

  describe('GET /integracoes', () => {
    it('informa os provedores em uso e os decoradores', async () => {
      await iniciar({ pilhaPadrao: ['cache', 'auditoria'] });

      const corpo = (await app.inject({ method: 'GET', url: '/integracoes' })).json();

      expect(corpo.provedores).toEqual({ armazenamento: 'local', pagamento: 'stripe', profissional: 'interno' });
      expect(corpo.decoradores).toEqual({ disponiveis: ['cache', 'auditoria', 'compressao'], padrao: ['cache', 'auditoria'] });
    });

    it('reflete outra configuração de provedores', async () => {
      await iniciar({
        adaptadores: () => ({
          armazenamento: new AdaptadorS3(new ClienteS3Simulado(), 'b'),
          pagamento: new AdaptadorPagSeguro(new PagSeguroSimulado()),
          profissional: new AdaptadorLinkedIn(new LinkedInSimulado())
        })
      });

      expect((await app.inject({ method: 'GET', url: '/integracoes' })).json().provedores).toEqual({
        armazenamento: 's3', pagamento: 'pagseguro', profissional: 'linkedin'
      });
    });

    it('a recomendação passa a usar os candidatos do provedor configurado', async () => {
      await iniciar({ adaptadores: () => ({ ...criarAdaptadoresDeTeste(), profissional: new AdaptadorLinkedIn(new LinkedInSimulado()) }) });

      const resposta = await post('/projetos/recomendacao', {
        ...base(), papeisRequeridos: [{ papel: 'DIRETOR', pesoImportancia: 0.5 }, { papel: 'EDITOR', pesoImportancia: 0.5 }]
      });

      expect(resposta.json().itens.map((i: { profissionalId: string }) => i.profissionalId)).toEqual([
        'linkedin:urn:li:person:1001', 'linkedin:urn:li:person:1002'
      ]);
    });
  });

  describe.each([
    ['local', () => criarAdaptadoresDeTeste().armazenamento],
    ['s3', () => new AdaptadorS3(new ClienteS3Simulado(), 'midia')],
    ['google-cloud', () => new AdaptadorGoogleCloud(new ClienteGoogleCloudSimulado(), 'midia')]
  ])('arquivos de um projeto (%s)', (provedor, criarArmazenamento) => {
    beforeEach(() => iniciar({ adaptadores: (repo) => ({ ...criarAdaptadoresDeTeste(repo), armazenamento: criarArmazenamento() }) }));

    it('envia, lista e baixa um arquivo, com os mesmos ids em qualquer provedor', async () => {
      const conteudo = Buffer.from('CENA 1 — INT. ESTÚDIO');

      const envio = await post('/projetos/proj-1/arquivos', { nome: 'roteiro.txt', conteudoBase64: conteudo.toString('base64'), tipoConteudo: 'text/plain' });
      const lista = await app.inject({ method: 'GET', url: '/projetos/proj-1/arquivos' });
      const download = await app.inject({ method: 'GET', url: '/projetos/proj-1/arquivos/roteiro.txt' });

      expect(envio.statusCode).toBe(201);
      expect(envio.json()).toEqual({ id: 'projetos/proj-1/roteiro.txt', provedor });
      expect(lista.json()).toEqual({ arquivos: ['projetos/proj-1/roteiro.txt'] });
      expect(Buffer.from(download.json().conteudoBase64, 'base64').equals(conteudo)).toBe(true);
      expect(download.json().tamanho).toBe(conteudo.length);
    });

    it('arquivo inexistente retorna 404', async () => {
      expect((await app.inject({ method: 'GET', url: '/projetos/proj-1/arquivos/nada.txt' })).statusCode).toBe(404);
    });

    it('identificador de projeto inválido retorna 400', async () => {
      const resposta = await post('/projetos/proj%201/arquivos', { nome: 'a.txt', conteudoBase64: 'eA==' });
      expect(resposta.statusCode).toBe(400);
    });

    it('nome de arquivo com barra retorna 400; corpo sem conteúdo é recusado pelo schema', async () => {
      expect((await post('/projetos/proj-1/arquivos', { nome: 'a/b.txt', conteudoBase64: 'eA==' })).statusCode).toBe(400);
      expect((await post('/projetos/proj-1/arquivos', { nome: 'a.txt' })).statusCode).toBe(400);
    });
  });

  describe.each([
    ['stripe', () => new AdaptadorStripe(new StripeSimulado())],
    ['pagseguro', () => new AdaptadorPagSeguro(new PagSeguroSimulado())]
  ])('pagamentos (%s)', (provedor, criarPagamento) => {
    beforeEach(() => iniciar({ adaptadores: (repo) => ({ ...criarAdaptadoresDeTeste(repo), pagamento: criarPagamento() }) }));

    it('efetua, consulta e cancela um pagamento', async () => {
      const criado = await post('/pagamentos', { valor: 1500, origem: 'produtor-1', destino: 'prof-1' });
      expect(criado.statusCode).toBe(201);
      expect(criado.json()).toMatchObject({ status: 'CONFIRMADO', provedor });
      const { id } = criado.json();

      expect((await app.inject({ method: 'GET', url: `/pagamentos/${id}` })).json()).toEqual({ id, status: 'CONFIRMADO' });
      expect((await post(`/pagamentos/${id}/cancelamento`)).json()).toEqual({ id, cancelado: true, status: 'CANCELADO' });
      expect((await post(`/pagamentos/${id}/cancelamento`)).json()).toEqual({ id, cancelado: false, status: 'CANCELADO' });
    });

    it('pagamento inexistente retorna 404', async () => {
      expect((await app.inject({ method: 'GET', url: '/pagamentos/nao-existe' })).statusCode).toBe(404);
      expect((await post('/pagamentos/nao-existe/cancelamento')).statusCode).toBe(404);
    });

    it('dados inválidos retornam 400', async () => {
      expect((await post('/pagamentos', { valor: 0, origem: 'a', destino: 'b' })).statusCode).toBe(400);
      expect((await post('/pagamentos', { valor: 10, origem: 'a' })).statusCode).toBe(400);
    });
  });

  it('um pagamento recusado pelo provedor retorna 402', async () => {
    await iniciar({ adaptadores: (repo) => ({ ...criarAdaptadoresDeTeste(repo), pagamento: new AdaptadorStripe(new StripeSimulado(1000)) }) });
    expect((await post('/pagamentos', { valor: 20, origem: 'a', destino: 'b' })).statusCode).toBe(402);
  });

  it('uma falha no provedor retorna 502', async () => {
    const quebrado = { paymentIntents: { create: async () => { throw new Error('rede'); } } } as unknown as StripeSimulado;
    await iniciar({ adaptadores: (repo) => ({ ...criarAdaptadoresDeTeste(repo), pagamento: new AdaptadorStripe(quebrado) }) });

    const resposta = await post('/pagamentos', { valor: 10, origem: 'a', destino: 'b' });

    expect(resposta.statusCode).toBe(502);
    expect(resposta.json().erro).toBe('Falha no serviço externo');
  });

  describe('POST /profissionais/:id/avaliacoes', () => {
    beforeEach(() => iniciar({ adaptadores: (repo) => ({ ...criarAdaptadoresDeTeste(repo), profissional: new AdaptadorLinkedIn(new LinkedInSimulado()) }) }));

    it('registra a avaliação no cadastro em uso (204)', async () => {
      const resposta = await post('/profissionais/linkedin:urn:li:person:1001/avaliacoes', { nota: 4.5, projetoId: 'p1', comentario: 'Ótimo' });
      expect(resposta.statusCode).toBe(204);
    });

    it('profissional inexistente retorna 404', async () => {
      expect((await post('/profissionais/linkedin:urn:li:person:9999/avaliacoes', { nota: 4, projetoId: 'p1' })).statusCode).toBe(404);
    });

    it('nota fora de 0 a 5 retorna 400', async () => {
      expect((await post('/profissionais/linkedin:urn:li:person:1001/avaliacoes', { nota: 6, projetoId: 'p1' })).statusCode).toBe(400);
    });
  });
});
