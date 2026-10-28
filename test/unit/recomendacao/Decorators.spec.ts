import { RecomendadorBase } from '../../../src/domain/recomendacao/RecomendadorBase';
import { RecomendadorDecorator } from '../../../src/domain/recomendacao/RecomendadorDecorator';
import {
  ArmazenamentoDeCache,
  CacheDecorator,
  chaveDeProjetosSimilares
} from '../../../src/domain/recomendacao/CacheDecorator';
import {
  AuditoriaDecorator,
  AuditoriaEmMemoria,
  RegistroDeRecomendacao
} from '../../../src/domain/recomendacao/AuditoriaDecorator';
import {
  CompressaoDecorator,
  EstatisticasDeCompressao,
  montarCarga
} from '../../../src/domain/recomendacao/CompressaoDecorator';
import {
  ConstrutorDePilhaDeRecomendacao,
  PilhaDeDecoradoresInvalidaError,
  criarConstrutorPadrao
} from '../../../src/domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { FabricaDecorada } from '../../../src/domain/factories/FabricaDecorada';
import { FabricaDocumentario } from '../../../src/domain/factories/documentario/FabricaDocumentario';
import { RecomendadorDocumentario } from '../../../src/domain/factories/documentario/RecomendadorDocumentario';
import { RecomendacaoStrategy } from '../../../src/domain/factories/TiposDeFabrica';
import { EstrategiaSimilaridadeCosseno } from '../../../src/domain/strategies/EstrategiaSimilaridadeCosseno';
import { Profissional } from '../../../src/domain/entities/Profissional';
import { Projeto } from '../../../src/domain/entities/Projeto';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarAvaliacao, criarCompetencia, criarProfissional, criarProjeto, dataFutura } from '../../fixtures/builders';

/** Recomendador base com atraso artificial e contador de chamadas — para medir o efeito do cache. */
class RecomendadorLento implements RecomendacaoStrategy {
  chamadas = 0;
  private readonly delegado = new RecomendadorBase(new EstrategiaSimilaridadeCosseno());

  constructor(private readonly atrasoMs = 25) {}

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional> {
    this.chamadas += 1;
    const fim = performance.now() + this.atrasoMs;
    while (performance.now() < fim) {
      /* espera ocupada: simula um cálculo caro */
    }
    return this.delegado.recomendar(projeto, profissionais);
  }
}

const todosOsPapeis = Object.values(PapelTecnico);

/** Um candidato rico (várias competências e avaliações) para cada papel técnico. */
function candidatos(): Profissional[] {
  return todosOsPapeis.map((papel, i) =>
    criarProfissional({
      nome: `Profissional ${papel}`,
      especialidadePrincipal: papel,
      historicoProjetos: ['p1', 'p2', 'p3', 'p4', 'p5'],
      competencias: [
        criarCompetencia('direcao_atores', 0.5 + i / 20),
        criarCompetencia('iluminacao_natural', 0.6),
        criarCompetencia('mixagem_audio', 0.7),
        criarCompetencia('edicao_avancada', 0.8),
        criarCompetencia('estrutura_narrativa', 0.9),
        criarCompetencia('modelagem_3d', 0.75)
      ],
      avaliacoes: [criarAvaliacao(4.5), criarAvaliacao(4.8), criarAvaliacao(5), criarAvaliacao(4.2)]
    })
  );
}

const projetoComTodosOsPapeis = (parcial: Parameters<typeof criarProjeto>[0] = {}) =>
  criarProjeto({
    dataEntrega: dataFutura(200),
    papeisRequeridos: todosOsPapeis.map((papel) => ({ papel, pesoImportancia: 1 / todosOsPapeis.length })),
    ...parcial
  });

describe('CacheDecorator', () => {
  it('reduz o tempo de resposta em requisições repetidas, sem chamar o recomendador base de novo', () => {
    const base = new RecomendadorLento(25);
    const cache = new ArmazenamentoDeCache();
    const recomendador = new CacheDecorator(base, cache);
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    const t0 = performance.now();
    const primeira = recomendador.recomendar(projeto, lista);
    const duracaoPrimeira = performance.now() - t0;

    const t1 = performance.now();
    const segunda = recomendador.recomendar(projeto, lista);
    const duracaoSegunda = performance.now() - t1;

    expect(duracaoPrimeira).toBeGreaterThanOrEqual(25);
    expect(duracaoSegunda).toBeLessThan(duracaoPrimeira / 2);
    expect(base.chamadas).toBe(1);
    expect(Array.from(segunda.entries())).toEqual(Array.from(primeira.entries()));
    expect(cache.estatisticas()).toEqual({ entradas: 1, acertos: 1, erros: 1 });
  });

  it('o resultado em cache é igual ao do recomendador base usado diretamente', () => {
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();
    const direto = new RecomendadorBase(new EstrategiaSimilaridadeCosseno()).recomendar(projeto, lista);

    const decorado = new CacheDecorator(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()), new ArmazenamentoDeCache());

    expect(Array.from(decorado.recomendar(projeto, lista).entries())).toEqual(Array.from(direto.entries()));
    expect(Array.from(decorado.recomendar(projeto, lista).entries())).toEqual(Array.from(direto.entries()));
  });

  it('projetos similares (só diferem em título, prazo, produtor e local) reaproveitam o resultado', () => {
    const base = new RecomendadorLento(1);
    const recomendador = new CacheDecorator(base, new ArmazenamentoDeCache());
    const lista = candidatos();

    recomendador.recomendar(projetoComTodosOsPapeis({ titulo: 'Projeto A', produtorId: 'p1' }), lista);
    recomendador.recomendar(
      projetoComTodosOsPapeis({
        titulo: 'Projeto B',
        produtorId: 'p2',
        dataEntrega: dataFutura(300),
        localizacao: { latitude: 1, longitude: 1, cidade: 'Recife' }
      }),
      lista
    );

    expect(base.chamadas).toBe(1);
  });

  it.each([
    ['orçamento diferente', (): Parameters<typeof criarProjeto>[0] => ({ orcamentoTotal: 99999 }), candidatos],
    [
      'papéis diferentes',
      (): Parameters<typeof criarProjeto>[0] => ({ papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }] }),
      candidatos
    ],
    ['outro conjunto de candidatos', (): Parameters<typeof criarProjeto>[0] => ({}), () => candidatos().slice(0, 3)]
  ])('não reaproveita o resultado quando há %s', (_descricao, alteracao, outrosCandidatos) => {
    const base = new RecomendadorLento(1);
    const recomendador = new CacheDecorator(base, new ArmazenamentoDeCache());
    const lista = candidatos();

    recomendador.recomendar(projetoComTodosOsPapeis(), lista);
    recomendador.recomendar(projetoComTodosOsPapeis(alteracao()), alteracao === undefined ? lista : outrosCandidatos());

    expect(base.chamadas).toBe(2);
  });

  it('devolve cópias: alterar o resultado recebido não corrompe o que está em cache', () => {
    const recomendador = new CacheDecorator(new RecomendadorLento(1), new ArmazenamentoDeCache());
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    const primeira = recomendador.recomendar(projeto, lista);
    const tamanhoOriginal = primeira.size;
    primeira.clear();
    const segunda = recomendador.recomendar(projeto, lista);

    expect(segunda.size).toBe(tamanhoOriginal);
    expect(segunda.size).toBeGreaterThan(0);
  });

  it('as entradas expiram depois do tempo de vida', () => {
    let agora = 1_000;
    const cache = new ArmazenamentoDeCache({ ttlMs: 100, relogio: () => agora });
    const base = new RecomendadorLento(1);
    const recomendador = new CacheDecorator(base, cache);
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    recomendador.recomendar(projeto, lista);
    agora += 99;
    recomendador.recomendar(projeto, lista); // ainda válida
    agora += 2;
    recomendador.recomendar(projeto, lista); // expirou

    expect(base.chamadas).toBe(2);
  });

  it('respeita a capacidade, descartando a entrada menos usada recentemente', () => {
    const cache = new ArmazenamentoDeCache({ capacidade: 2 });
    cache.guardar('a', new Map());
    cache.guardar('b', new Map());
    cache.obter('a'); // 'a' passa a ser a mais recente
    cache.guardar('c', new Map()); // expulsa 'b'

    expect(cache.obter('a')).toBeDefined();
    expect(cache.obter('b')).toBeUndefined();
    expect(cache.obter('c')).toBeDefined();
    expect(cache.estatisticas().entradas).toBe(2);
  });

  it('limpar() esvazia o cache e zera as estatísticas', () => {
    const cache = new ArmazenamentoDeCache();
    cache.guardar('a', new Map());
    cache.obter('a');
    cache.limpar();
    expect(cache.estatisticas()).toEqual({ entradas: 0, acertos: 0, erros: 0 });
  });

  it('aceita um gerador de chaves próprio', () => {
    const base = new RecomendadorLento(1);
    const recomendador = new CacheDecorator(base, new ArmazenamentoDeCache(), () => 'sempre-a-mesma');

    recomendador.recomendar(projetoComTodosOsPapeis(), candidatos());
    recomendador.recomendar(projetoComTodosOsPapeis({ orcamentoTotal: 1 }), candidatos());

    expect(base.chamadas).toBe(1);
  });

  it('a chave padrão distingue recomendadores diferentes', () => {
    const projeto = projetoComTodosOsPapeis();
    const a = chaveDeProjetosSimilares(projeto, [], new RecomendadorLento());
    const b = chaveDeProjetosSimilares(projeto, [], new RecomendadorDocumentario());
    expect(a).not.toBe(b);
  });
});

describe('AuditoriaDecorator', () => {
  it('registra todas as chamadas, com tipo, candidatos, membros e duração', () => {
    const registrador = new AuditoriaEmMemoria();
    let relogio = 0;
    const recomendador = new AuditoriaDecorator(new RecomendadorLento(1), registrador, () => (relogio += 10));
    const projeto = projetoComTodosOsPapeis({ titulo: 'Meu projeto' });
    const lista = candidatos();

    recomendador.recomendar(projeto, lista);
    recomendador.recomendar(projeto, lista);
    recomendador.recomendar(projeto, lista);

    expect(registrador.total()).toBe(3);
    const [maisRecente] = registrador.ultimos(1);
    expect(maisRecente).toMatchObject({
      recomendador: 'RecomendadorLento',
      tipoProjeto: 'DOCUMENTARIO',
      titulo: 'Meu projeto',
      candidatos: todosOsPapeis.length,
      membrosRecomendados: todosOsPapeis.length,
      duracaoMs: 10,
      sucesso: true
    });
    expect(new Date(maisRecente.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('registra a falha e a propaga, sem engolir o erro', () => {
    const registrador = new AuditoriaEmMemoria();
    const quebrado: RecomendacaoStrategy = {
      recomendar: () => {
        throw new Error('algoritmo indisponível');
      }
    };
    const recomendador = new AuditoriaDecorator(quebrado, registrador);

    expect(() => recomendador.recomendar(projetoComTodosOsPapeis(), candidatos())).toThrow('algoritmo indisponível');

    expect(registrador.ultimos(1)[0]).toMatchObject({ sucesso: false, erro: 'algoritmo indisponível', membrosRecomendados: 0 });
  });

  it('devolve exatamente o resultado do recomendador interno', () => {
    const base = new RecomendadorBase(new EstrategiaSimilaridadeCosseno());
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    const decorado = new AuditoriaDecorator(base, new AuditoriaEmMemoria()).recomendar(projeto, lista);

    expect(Array.from(decorado.entries())).toEqual(Array.from(base.recomendar(projeto, lista).entries()));
  });

  it('AuditoriaEmMemoria mantém só os últimos registros, repassa ao espelho e lista do mais novo ao mais antigo', () => {
    const espelhados: RegistroDeRecomendacao[] = [];
    const registrador = new AuditoriaEmMemoria(2, (registro) => espelhados.push(registro));
    const registro = (titulo: string): RegistroDeRecomendacao => ({
      timestamp: new Date().toISOString(), recomendador: 'X', tipoProjeto: 'DOCUMENTARIO', titulo,
      candidatos: 0, membrosRecomendados: 0, duracaoMs: 0, sucesso: true
    });

    registrador.registrar(registro('um'));
    registrador.registrar(registro('dois'));
    registrador.registrar(registro('três'));

    expect(registrador.total()).toBe(3);
    expect(registrador.ultimos().map((r) => r.titulo)).toEqual(['três', 'dois']);
    expect(espelhados).toHaveLength(3);
  });
});

describe('CompressaoDecorator', () => {
  it('reduz o tamanho dos dados transmitidos', () => {
    const estatisticas = new EstatisticasDeCompressao();
    const recomendador = new CompressaoDecorator(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()), estatisticas);

    recomendador.recomendar(projetoComTodosOsPapeis(), candidatos());

    const resumo = recomendador.resumo();
    expect(resumo.chamadas).toBe(1);
    expect(resumo.bytesOriginais).toBeGreaterThan(1500);
    expect(resumo.bytesComprimidos).toBeLessThan(resumo.bytesOriginais);
    expect(resumo.taxaDeCompressao).toBeGreaterThan(0.4);
    expect(recomendador.ultimaCarga()!.length).toBe(resumo.bytesComprimidos);
  });

  it('a carga comprimida volta, íntegra, ao conteúdo original', () => {
    const recomendador = new CompressaoDecorator(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()));
    const equipe = recomendador.recomendar(projetoComTodosOsPapeis(), candidatos());

    const recuperada = CompressaoDecorator.descomprimir(recomendador.ultimaCarga()!);

    expect(recuperada).toEqual(JSON.parse(JSON.stringify(montarCarga(equipe))));
    expect(Object.keys(recuperada).sort()).toEqual(Array.from(equipe.keys()).sort());
  });

  it('não altera o resultado devolvido a quem chamou', () => {
    const base = new RecomendadorBase(new EstrategiaSimilaridadeCosseno());
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    const comprimido = new CompressaoDecorator(base).recomendar(projeto, lista);

    expect(Array.from(comprimido.entries())).toEqual(Array.from(base.recomendar(projeto, lista).entries()));
  });

  it('acumula as estatísticas entre chamadas e entre decoradores que as compartilham', () => {
    const estatisticas = new EstatisticasDeCompressao();
    const base = new RecomendadorBase(new EstrategiaSimilaridadeCosseno());
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    new CompressaoDecorator(base, estatisticas).recomendar(projeto, lista);
    new CompressaoDecorator(base, estatisticas).recomendar(projeto, lista);

    expect(estatisticas.resumo().chamadas).toBe(2);
  });

  it('informa honestamente quando a compressão não compensa (carga minúscula)', () => {
    const recomendador = new CompressaoDecorator(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()));

    recomendador.recomendar(criarProjeto({ papeisRequeridos: [] }), []); // equipe vazia: "{}"

    expect(recomendador.resumo().taxaDeCompressao).toBeLessThan(0);
  });

  it('sem chamadas, não há carga nem taxa', () => {
    const recomendador = new CompressaoDecorator(new RecomendadorLento(1));
    expect(recomendador.ultimaCarga()).toBeUndefined();
    expect(recomendador.resumo().taxaDeCompressao).toBe(0);
  });
});

describe('Pilha de decoradores — combinação em diferentes ordens, definida em tempo de execução', () => {
  function montar() {
    const cache = new ArmazenamentoDeCache();
    const auditoria = new AuditoriaEmMemoria();
    const compressao = new EstatisticasDeCompressao();
    return { cache, auditoria, compressao, construtor: criarConstrutorPadrao({ cache, auditoria, compressao }) };
  }

  it('empilha na ordem pedida: o primeiro nome fica por dentro, o último por fora', () => {
    const { construtor } = montar();

    const pilha = construtor.construir(new RecomendadorLento(1), ['cache', 'auditoria', 'compressao']);

    expect(pilha).toBeInstanceOf(CompressaoDecorator);
    const meio = (pilha as unknown as { interno: RecomendacaoStrategy }).interno;
    expect(meio).toBeInstanceOf(AuditoriaDecorator);
    const dentro = (meio as unknown as { interno: RecomendacaoStrategy }).interno;
    expect(dentro).toBeInstanceOf(CacheDecorator);
  });

  it('cache → auditoria → compressão: cache primeiro, auditoria vê todas as chamadas e a compressão age em todas', () => {
    const { construtor, cache, auditoria, compressao } = montar();
    const base = new RecomendadorLento(1);
    const pilha = construtor.construir(base, ['cache', 'auditoria', 'compressao']);
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    pilha.recomendar(projeto, lista);
    pilha.recomendar(projeto, lista);

    expect(base.chamadas).toBe(1); // o cache evitou a segunda chamada ao base
    expect(cache.estatisticas()).toMatchObject({ acertos: 1, erros: 1 });
    expect(auditoria.total()).toBe(2); // a auditoria está por fora do cache e vê as duas
    expect(compressao.resumo().chamadas).toBe(2);
  });

  it('auditoria → cache: com o cache por fora, a auditoria só vê o que passou do cache', () => {
    const { construtor, auditoria } = montar();
    const base = new RecomendadorLento(1);
    const pilha = construtor.construir(base, ['auditoria', 'cache']);
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    pilha.recomendar(projeto, lista);
    pilha.recomendar(projeto, lista);

    expect(base.chamadas).toBe(1);
    expect(auditoria.total()).toBe(1); // a segunda chamada foi atendida pelo cache, antes da auditoria
  });

  it('todas as ordens possíveis dão o mesmo resultado de recomendação', () => {
    const { construtor } = montar();
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();
    const esperado = Array.from(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()).recomendar(projeto, lista).entries());
    const ordens = [
      ['cache', 'auditoria', 'compressao'], ['cache', 'compressao', 'auditoria'],
      ['auditoria', 'cache', 'compressao'], ['auditoria', 'compressao', 'cache'],
      ['compressao', 'cache', 'auditoria'], ['compressao', 'auditoria', 'cache']
    ];

    for (const ordem of ordens) {
      const pilha = construtor.construir(new RecomendadorBase(new EstrategiaSimilaridadeCosseno()), ordem);
      expect(Array.from(pilha.recomendar(projeto, lista).entries())).toEqual(esperado);
    }
  });

  it('uma pilha vazia devolve o próprio recomendador base', () => {
    const { construtor } = montar();
    const base = new RecomendadorLento(1);
    expect(construtor.construir(base, [])).toBe(base);
  });

  it('o estado (cache, auditoria) é compartilhado entre pilhas montadas em momentos diferentes', () => {
    const { construtor, auditoria } = montar();
    const base = new RecomendadorLento(1);
    const projeto = projetoComTodosOsPapeis();
    const lista = candidatos();

    construtor.construir(base, ['cache', 'auditoria']).recomendar(projeto, lista);
    construtor.construir(base, ['cache', 'auditoria']).recomendar(projeto, lista); // outra "requisição"

    expect(base.chamadas).toBe(1);
    expect(auditoria.total()).toBe(2);
  });

  it('rejeita nomes de decoradores desconhecidos, informando os disponíveis', () => {
    const { construtor } = montar();

    expect(() => construtor.construir(new RecomendadorLento(1), ['cache', 'magia'])).toThrow(PilhaDeDecoradoresInvalidaError);
    expect(() => construtor.validar(['magia'])).toThrow(/magia.*Disponíveis: cache, auditoria, compressao/);
  });

  it('aceita novos decoradores registrados em tempo de execução, sem alterar nenhuma outra classe', () => {
    class ContadorDecorator extends RecomendadorDecorator {
      readonly nome = 'contador';
      static chamadas = 0;
      recomendar(projeto: Projeto, profissionais: Profissional[]) {
        ContadorDecorator.chamadas += 1;
        return this.interno.recomendar(projeto, profissionais);
      }
    }
    const { construtor } = montar();
    construtor.registrar('contador', (interno) => new ContadorDecorator(interno));

    construtor.construir(new RecomendadorLento(1), ['contador', 'cache']).recomendar(projetoComTodosOsPapeis(), candidatos());

    expect(construtor.nomesDisponiveis()).toContain('contador');
    expect(ContadorDecorator.chamadas).toBe(1);
  });

  it('ConstrutorDePilhaDeRecomendacao vazio não conhece nenhum decorador', () => {
    expect(new ConstrutorDePilhaDeRecomendacao().nomesDisponiveis()).toEqual([]);
  });
});

describe('FabricaDecorada', () => {
  it('delega projeto, validador e notificador, e decora apenas o recomendador', () => {
    const original = new FabricaDocumentario();
    const decoracoes: string[] = [];
    const fabrica = new FabricaDecorada(original, (r) => {
      decoracoes.push(r.constructor.name);
      return r;
    });

    expect(fabrica.criarValidador().constructor).toBe(original.criarValidador().constructor);
    expect(fabrica.criarNotificador().constructor).toBe(original.criarNotificador().constructor);
    expect(fabrica.criarProjeto({ titulo: 'T' }).constructor.name).toBe('ProjetoDocumentario');
    expect(decoracoes).toEqual([]);

    fabrica.criarRecomendador();
    expect(decoracoes).toEqual(['RecomendadorDocumentario']);
  });

  it('permite substituir o recomendador padrão da família, mantendo a decoração', () => {
    const substituto = new RecomendadorLento(1);
    const fabrica = new FabricaDecorada(
      new FabricaDocumentario(),
      (r) => new AuditoriaDecorator(r, new AuditoriaEmMemoria()),
      () => substituto
    );

    const recomendador = fabrica.criarRecomendador();

    expect(recomendador).toBeInstanceOf(AuditoriaDecorator);
    expect((recomendador as unknown as { interno: unknown }).interno).toBe(substituto);
  });
});
