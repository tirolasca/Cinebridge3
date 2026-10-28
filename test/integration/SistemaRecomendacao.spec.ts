import { SistemaRecomendacao } from '../../src/application/services/SistemaRecomendacao';
import { SeletorDeFabricaProjeto } from '../../src/domain/factories/SeletorDeFabricaProjeto';
import { OrquestradorPadraoDeFabrica } from '../../src/application/orchestrator/OrquestradorPadraoDeFabrica';
import { SujeitoDeEventos } from '../../src/domain/events/Observer';
import { NomeEvento, EventoDominio } from '../../src/domain/events/EventosDominio';
import { RepositorioProfissionais } from '../../src/application/services/RepositorioProfissionais';
import { Profissional } from '../../src/domain/entities/Profissional';
import { ProjetoDocumentario } from '../../src/domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../src/domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../src/domain/entities/ProjetoPublicitario';
import { criarProfissional, criarCompetencia, dataFutura } from '../fixtures/builders';
import { criarAdaptadoresDeTeste } from '../fixtures/adaptadores';
import { PapelTecnico, TipoCaptacao } from '../../src/domain/entities/types';

/**
 * Este teste demonstra, conforme pedido na atividade, que ao alternar entre
 * diferentes fábricas o sistema produz recomendações, validações e
 * notificações consistentes com o tipo de projeto, SEM que nenhuma linha de
 * código do SistemaRecomendacao ou do OrquestradorEquipe precise ser
 * alterada para acomodar um tipo de projeto diferente — toda a variação de
 * comportamento está encapsulada nas fábricas concretas e nos objetos que
 * elas produzem.
 */
/** Adaptadores que não são consultados nos testes de `recomendar()` (candidatos vêm prontos). */
const adaptadoresVazios = criarAdaptadoresDeTeste();

describe('SistemaRecomendacao — integração entre Factory Method, Abstract Factory e Template Method', () => {
  function montarProfissionais() {
    return [
      criarProfissional({
        nome: 'Diretor Competente',
        especialidadePrincipal: PapelTecnico.DIRETOR,
        faixaDePreco: { minimo: 2000, maximo: 4000 },
        competencias: [criarCompetencia('direcao_atores', 0.9)]
      }),
      criarProfissional({
        nome: 'VFX com modelagem 3D',
        especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
        faixaDePreco: { minimo: 3000, maximo: 5000 },
        competencias: [criarCompetencia('modelagem_3d', 0.9)]
      })
    ];
  }

  it('gera equipe para um ProjetoDocumentario usando a família de objetos documentário', async () => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), adaptadoresVazios);
    const projeto = new ProjetoDocumentario({
      titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 40, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
      produtorId: 'p1', tema: 'Tema X', entrevistados: ['Fulano']
    });

    const equipe = await sistema.recomendar(projeto, montarProfissionais());

    expect(equipe.get(PapelTecnico.DIRETOR)?.nome).toBe('Diretor Competente');
  });

  it('gera equipe para um ProjetoAnimacao usando a família de objetos animação — MESMO SistemaRecomendacao, nenhuma alteração de código', async () => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), adaptadoresVazios);
    const projeto = new ProjetoAnimacao({
      titulo: 'Anim', genero: 'anim', duracaoEstimadaMinutos: 20, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.ESPECIALISTA_VFX, pesoImportancia: 1 }],
      produtorId: 'p2', tecnicaAnimacao: '3D', softwarePrincipal: 'Blender'
    });

    const equipe = await sistema.recomendar(projeto, montarProfissionais());

    expect(equipe.get(PapelTecnico.ESPECIALISTA_VFX)?.nome).toBe('VFX com modelagem 3D');
  });

  it('rejeita um ProjetoAnimacao inválido para a família (sem técnica/software) sem afetar outros tipos', async () => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), adaptadoresVazios);
    const projetoInvalido = new ProjetoAnimacao({
      titulo: 'Anim Incompleto', genero: 'anim', duracaoEstimadaMinutos: 20, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.ESPECIALISTA_VFX, pesoImportancia: 1 }],
      produtorId: 'p3', tecnicaAnimacao: '', softwarePrincipal: ''
    });

    await expect(sistema.recomendar(projetoInvalido, montarProfissionais())).rejects.toThrow(
      /não atende às restrições/
    );
  });

  it('o validador da família filtra profissionais inadequados antes da recomendação (ProjetoAnimacao exige modelagem_3d/motion_graphics para VFX)', async () => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), adaptadoresVazios);
    const projeto = new ProjetoAnimacao({
      titulo: 'Anim', genero: 'anim', duracaoEstimadaMinutos: 20, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.ESPECIALISTA_VFX, pesoImportancia: 1 }],
      produtorId: 'p4', tecnicaAnimacao: '3D', softwarePrincipal: 'Blender'
    });

    const vfxSemCompetenciaAdequada = criarProfissional({
      nome: 'VFX Genérico',
      especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
      competencias: [criarCompetencia('composicao_digital', 0.9)] // não é modelagem_3d nem motion_graphics
    });

    const equipe = await sistema.recomendar(projeto, [vfxSemCompetenciaAdequada]);

    // O candidato foi filtrado pelo validador da família animação antes de
    // chegar ao recomendador — a equipe fica sem esse papel preenchido.
    expect(equipe.has(PapelTecnico.ESPECIALISTA_VFX)).toBe(false);
  });

  it('alternar entre as três fábricas no mesmo SistemaRecomendacao produz resultados coerentes com cada tipo, usando sempre o mesmo OrquestradorPadraoDeFabrica', async () => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), adaptadoresVazios);
    const profissionais = montarProfissionais();

    const projetoDocumentario = new ProjetoDocumentario({
      titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 40, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
      produtorId: 'p5', tema: 'Tema', entrevistados: ['A']
    });

    const projetoPublicitario = new ProjetoPublicitario({
      titulo: 'Publi', genero: 'publi', duracaoEstimadaMinutos: 1, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.FICCAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
      produtorId: 'p6', marcaAnunciante: 'Marca', dataVeiculacao: dataFutura(150)
    });

    // Mesma instância de SistemaRecomendacao, dois tipos de projeto distintos,
    // nenhuma alteração de código entre as duas chamadas.
    const equipeDocumentario = await sistema.recomendar(projetoDocumentario, profissionais);
    const equipePublicitario = await sistema.recomendar(projetoPublicitario, profissionais);

    expect(equipeDocumentario.get(PapelTecnico.DIRETOR)?.nome).toBe('Diretor Competente');
    expect(equipePublicitario.get(PapelTecnico.DIRETOR)?.nome).toBe('Diretor Competente');
  });

  it('aceita explicitamente um OrquestradorPadraoDeFabrica construído com a fábrica correspondente', async () => {
    const seletor = new SeletorDeFabricaProjeto();
    const sistema = new SistemaRecomendacao(seletor, new SujeitoDeEventos(), adaptadoresVazios);
    const fabrica = seletor.obterFabrica('DOCUMENTARIO' as any);
    const orquestrador = new OrquestradorPadraoDeFabrica(fabrica);

    const projeto = new ProjetoDocumentario({
      titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 40, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
      produtorId: 'p7', tema: 'Tema', entrevistados: ['A']
    });

    const equipe = await sistema.recomendar(projeto, montarProfissionais(), orquestrador);

    expect(equipe.get(PapelTecnico.DIRETOR)?.nome).toBe('Diretor Competente');
  });
});


describe('SistemaRecomendacao.gerarRecomendacao — fluxo completo com repositório, fallback e eventos', () => {
  // O notificador da família escreve no console; silencia para manter a saída limpa.
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { jest.restoreAllMocks(); });

  /** Repositório em memória; papéis em `papeisComFalha` simulam indisponibilidade. */
  class RepositorioEmMemoria implements RepositorioProfissionais {
    readonly consultas: PapelTecnico[] = [];
    constructor(
      private readonly profissionais: Profissional[],
      private readonly papeisComFalha: Set<PapelTecnico> = new Set()
    ) {}
    async buscarPorPapel(papel: PapelTecnico): Promise<Profissional[]> {
      this.consultas.push(papel);
      if (this.papeisComFalha.has(papel)) throw new Error(`indisponível: ${papel}`);
      return this.profissionais.filter((p) => p.especialidadePrincipal === papel);
    }
  }

  const profissionais = () => [
    criarProfissional({ nome: 'Diretora', especialidadePrincipal: PapelTecnico.DIRETOR }),
    criarProfissional({ nome: 'Editor', especialidadePrincipal: PapelTecnico.EDITOR })
  ];

  const projetoDocumentario = (parcial: Partial<ConstructorParameters<typeof ProjetoDocumentario>[0]> = {}) =>
    new ProjetoDocumentario({
      titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 40, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.5 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 0.5 }
      ],
      produtorId: 'p1', tema: 'Tema', entrevistados: ['A'],
      ...parcial
    });

  it('busca os candidatos no repositório e devolve a equipe completa', async () => {
    const repositorio = new RepositorioEmMemoria(profissionais());
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(repositorio));

    const resultado = await sistema.gerarRecomendacao(projetoDocumentario());

    expect(resultado.tipoProjeto).toBe('DOCUMENTARIO');
    expect(resultado.parcial).toBe(false);
    expect(resultado.itens.map((i) => i.nome).sort()).toEqual(['Diretora', 'Editor']);
    expect(repositorio.consultas.sort()).toEqual([PapelTecnico.DIRETOR, PapelTecnico.EDITOR].sort());
  });

  it('consulta o repositório uma única vez por papel, mesmo com papéis repetidos', async () => {
    const repositorio = new RepositorioEmMemoria(profissionais());
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(repositorio));
    const projeto = projetoDocumentario({
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.5 },
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.5 }
      ]
    });

    await sistema.gerarRecomendacao(projeto);

    expect(repositorio.consultas).toEqual([PapelTecnico.DIRETOR]);
  });

  it('retorna recomendação parcial quando o repositório falha para um papel', async () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const repositorio = new RepositorioEmMemoria(profissionais(), new Set([PapelTecnico.EDITOR]));
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(repositorio));

    const resultado = await sistema.gerarRecomendacao(projetoDocumentario());

    expect(resultado.parcial).toBe(true);
    expect(resultado.itens.map((i) => i.papel)).toEqual([PapelTecnico.DIRETOR]);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });

  it('marca como parcial quando não há candidato para algum papel requerido', async () => {
    const repositorio = new RepositorioEmMemoria([profissionais()[0]]); // só a diretora
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(repositorio));

    const resultado = await sistema.gerarRecomendacao(projetoDocumentario());

    expect(resultado.parcial).toBe(true);
    expect(resultado.itens).toHaveLength(1);
  });

  it('publica RECOMENDACAO_GERADA para os observadores e para o notificador da família', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const sujeito = new SujeitoDeEventos();
    const eventos: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventos.push(e); } });
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), sujeito, criarAdaptadoresDeTeste(new RepositorioEmMemoria(profissionais())));

    await sistema.gerarRecomendacao(projetoDocumentario());

    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe(NomeEvento.RECOMENDACAO_GERADA);
    // O notificador da família documentário também recebeu o evento.
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[NotificadorDocumentario]'), expect.anything());
    log.mockRestore();
  });

  it('desinscreve o notificador da família ao final, com sucesso ou com erro', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const sujeito = new SujeitoDeEventos();
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), sujeito, criarAdaptadoresDeTeste(new RepositorioEmMemoria(profissionais())));

    await sistema.gerarRecomendacao(projetoDocumentario());
    expect(sujeito.quantidadeDeObservadores()).toBe(0);

    await expect(sistema.gerarRecomendacao(projetoDocumentario({ tema: '' }))).rejects.toThrow();
    expect(sujeito.quantidadeDeObservadores()).toBe(0);
    log.mockRestore();
  });

  it('rejeita projeto que não atende às restrições do tipo, sem publicar evento', async () => {
    const sujeito = new SujeitoDeEventos();
    const eventos: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventos.push(e); } });
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), sujeito, criarAdaptadoresDeTeste(new RepositorioEmMemoria(profissionais())));

    await expect(sistema.gerarRecomendacao(projetoDocumentario({ entrevistados: [] }))).rejects.toThrow(
      /não atende às restrições/
    );
    expect(eventos).toHaveLength(0);
  });

  it.each([
    ['data de entrega no passado', { dataEntrega: new Date('2020-01-01') }, /Data de entrega/],
    ['orçamento zerado', { orcamentoTotal: 0 }, /Orçamento total/],
    ['nenhum papel requerido', { papeisRequeridos: [] }, /ao menos um papel/]
  ])('aplica as restrições comuns a todos os tipos: %s', async (_nome, alteracao, mensagem) => {
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(new RepositorioEmMemoria(profissionais())));

    await expect(sistema.gerarRecomendacao(projetoDocumentario(alteracao))).rejects.toThrow(mensagem);
  });

  it('funciona para o tipo animação com o mesmo SistemaRecomendacao', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const vfx = criarProfissional({
      nome: 'VFX 3D',
      especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
      competencias: [criarCompetencia('modelagem_3d', 0.9)]
    });
    const sistema = new SistemaRecomendacao(new SeletorDeFabricaProjeto(), new SujeitoDeEventos(), criarAdaptadoresDeTeste(new RepositorioEmMemoria([vfx])));
    const projeto = new ProjetoAnimacao({
      titulo: 'Anim', genero: 'anim', duracaoEstimadaMinutos: 20, orcamentoTotal: 10000,
      dataEntrega: dataFutura(120), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
      papeisRequeridos: [{ papel: PapelTecnico.ESPECIALISTA_VFX, pesoImportancia: 1 }],
      produtorId: 'p2', tecnicaAnimacao: '3D', softwarePrincipal: 'Blender'
    });

    const resultado = await sistema.gerarRecomendacao(projeto);

    expect(resultado.tipoProjeto).toBe('ANIMACAO');
    expect(resultado.itens[0].nome).toBe('VFX 3D');
    log.mockRestore();
  });
});
