import { FabricaDocumentario } from '../../../src/domain/factories/documentario/FabricaDocumentario';
import { FabricaAnimacao } from '../../../src/domain/factories/animacao/FabricaAnimacao';
import { FabricaPublicitario } from '../../../src/domain/factories/publicitario/FabricaPublicitario';
import { ProjetoDocumentario } from '../../../src/domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../../src/domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../../src/domain/entities/ProjetoPublicitario';
import { ValidadorDocumentario } from '../../../src/domain/factories/documentario/ValidadorDocumentario';
import { ValidadorAnimacao } from '../../../src/domain/factories/animacao/ValidadorAnimacao';
import { ValidadorPublicitario } from '../../../src/domain/factories/publicitario/ValidadorPublicitario';
import { RecomendadorDocumentario } from '../../../src/domain/factories/documentario/RecomendadorDocumentario';
import { RecomendadorAnimacao } from '../../../src/domain/factories/animacao/RecomendadorAnimacao';
import { RecomendadorPublicitario } from '../../../src/domain/factories/publicitario/RecomendadorPublicitario';
import { NotificadorDocumentario } from '../../../src/domain/factories/documentario/NotificadorDocumentario';
import { NotificadorAnimacao } from '../../../src/domain/factories/animacao/NotificadorAnimacao';
import { NotificadorPublicitario } from '../../../src/domain/factories/publicitario/NotificadorPublicitario';
import { PapelTecnico, TipoCaptacao } from '../../../src/domain/entities/types';
import { dataFutura } from '../../fixtures/builders';

describe('Abstract Factory — cada fábrica produz uma família coerente de objetos', () => {
  const dadosBase = {
    titulo: 'Projeto de teste',
    genero: 'teste',
    duracaoEstimadaMinutos: 10,
    orcamentoTotal: 10000,
    dataEntrega: dataFutura(120),
    tipoCaptacao: TipoCaptacao.FICCAO,
    localizacao: { latitude: 0, longitude: 0, cidade: 'X' },
    papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
    produtorId: 'produtor-1'
  };

  describe('FabricaDocumentario', () => {
    const fabrica = new FabricaDocumentario();

    it('produz um ProjetoDocumentario', () => {
      expect(fabrica.criarProjeto(dadosBase)).toBeInstanceOf(ProjetoDocumentario);
    });

    it('produz o validador, recomendador e notificador da família documentário', () => {
      expect(fabrica.criarValidador()).toBeInstanceOf(ValidadorDocumentario);
      expect(fabrica.criarRecomendador()).toBeInstanceOf(RecomendadorDocumentario);
      expect(fabrica.criarNotificador()).toBeInstanceOf(NotificadorDocumentario);
    });
  });

  describe('FabricaAnimacao', () => {
    const fabrica = new FabricaAnimacao();

    it('produz um ProjetoAnimacao', () => {
      expect(fabrica.criarProjeto(dadosBase)).toBeInstanceOf(ProjetoAnimacao);
    });

    it('produz o validador, recomendador e notificador da família animação', () => {
      expect(fabrica.criarValidador()).toBeInstanceOf(ValidadorAnimacao);
      expect(fabrica.criarRecomendador()).toBeInstanceOf(RecomendadorAnimacao);
      expect(fabrica.criarNotificador()).toBeInstanceOf(NotificadorAnimacao);
    });
  });

  describe('FabricaPublicitario', () => {
    const fabrica = new FabricaPublicitario();

    it('produz um ProjetoPublicitario', () => {
      expect(fabrica.criarProjeto(dadosBase)).toBeInstanceOf(ProjetoPublicitario);
    });

    it('produz o validador, recomendador e notificador da família publicitário', () => {
      expect(fabrica.criarValidador()).toBeInstanceOf(ValidadorPublicitario);
      expect(fabrica.criarRecomendador()).toBeInstanceOf(RecomendadorPublicitario);
      expect(fabrica.criarNotificador()).toBeInstanceOf(NotificadorPublicitario);
    });
  });

  it('o validador de uma família rejeita um projeto de outra família (coerência entre fábrica e produto)', () => {
    const projetoDeAnimacao = new FabricaAnimacao().criarProjeto({
      ...dadosBase,
      tipoCaptacao: TipoCaptacao.ANIMACAO
    } as any);

    const validadorDocumentario = new FabricaDocumentario().criarValidador();

    // O validador de documentário espera um ProjetoDocumentario; perante um
    // projeto de outra família, rejeita explicitamente (instanceof falha).
    expect(validadorDocumentario.visitarProjeto(projetoDeAnimacao)).toBe(false);
  });
});
