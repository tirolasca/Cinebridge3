import { ArvoreDeComposicao } from '../../../src/domain/visitors/ArvoreDeComposicao';
import { VisitanteValidacaoConsistencia } from '../../../src/domain/visitors/VisitanteValidacaoConsistencia';
import { VisitanteMetricaCompatibilidade } from '../../../src/domain/visitors/VisitanteMetricaCompatibilidade';
import { VisitanteRelatorioEquipe } from '../../../src/domain/visitors/VisitanteRelatorioEquipe';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarAvaliacao, criarProjeto } from '../../fixtures/builders';

describe('Visitor — operações transversais sobre ArvoreDeComposicao', () => {
  function montarArvoreCompleta() {
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.6 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 0.4 }
      ]
    });

    const diretor = criarProfissional({
      nome: 'Diretor Um',
      faixaDePreco: { minimo: 3000, maximo: 4000 },
      avaliacoes: [criarAvaliacao(4)]
    });
    const editor = criarProfissional({
      nome: 'Editor Um',
      faixaDePreco: { minimo: 2000, maximo: 3000 },
      avaliacoes: [criarAvaliacao(5)]
    });

    const equipe = new Map([
      [PapelTecnico.DIRETOR, diretor],
      [PapelTecnico.EDITOR, editor]
    ]);

    return new ArvoreDeComposicao(projeto, equipe);
  }

  describe('VisitanteValidacaoConsistencia', () => {
    it('valida com sucesso uma equipe completa dentro do orçamento', () => {
      const arvore = montarArvoreCompleta();
      const resultado = arvore.aceitar(new VisitanteValidacaoConsistencia());

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('reporta erro quando falta um papel obrigatório', () => {
      const projeto = criarProjeto({
        papeisRequeridos: [
          { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.5 },
          { papel: PapelTecnico.SONOPLASTA, pesoImportancia: 0.5 }
        ]
      });
      const diretor = criarProfissional();
      const arvore = new ArvoreDeComposicao(projeto, new Map([[PapelTecnico.DIRETOR, diretor]]));

      const resultado = arvore.aceitar(new VisitanteValidacaoConsistencia());

      expect(resultado.valido).toBe(false);
      expect(resultado.erros[0]).toContain('SONOPLASTA');
    });

    it('reporta erro quando o custo total da equipe excede o orçamento do projeto', () => {
      const projeto = criarProjeto({
        orcamentoTotal: 1000,
        papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
      });
      const diretorCaro = criarProfissional({ faixaDePreco: { minimo: 5000, maximo: 6000 } });
      const arvore = new ArvoreDeComposicao(projeto, new Map([[PapelTecnico.DIRETOR, diretorCaro]]));

      const resultado = arvore.aceitar(new VisitanteValidacaoConsistencia());

      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('excede o orçamento'))).toBe(true);
    });
  });

  describe('VisitanteMetricaCompatibilidade', () => {
    it('calcula pontuação geral ponderada pelos pesos de importância dos papéis', () => {
      const arvore = montarArvoreCompleta();
      const resultado = arvore.aceitar(new VisitanteMetricaCompatibilidade());

      // Diretor: nota 4/5 = 0.8, peso 0.6 | Editor: nota 5/5 = 1.0, peso 0.4
      const esperado = 0.8 * 0.6 + 1.0 * 0.4;
      expect(resultado.pontuacaoGeral).toBeCloseTo(esperado, 5);
    });

    it('atribui pontuação 0 para papéis sem profissional alocado', () => {
      const projeto = criarProjeto({
        papeisRequeridos: [{ papel: PapelTecnico.EDITOR, pesoImportancia: 1 }]
      });
      const arvore = new ArvoreDeComposicao(projeto, new Map());

      const resultado = arvore.aceitar(new VisitanteMetricaCompatibilidade());

      expect(resultado.pontuacaoGeral).toBe(0);
      expect(resultado.pontuacaoPorPapel[PapelTecnico.EDITOR]).toBe(0);
    });
  });

  describe('VisitanteRelatorioEquipe', () => {
    it('gera relatório com todos os membros, nomes e custo total', () => {
      const arvore = montarArvoreCompleta();
      const relatorio = arvore.aceitar(new VisitanteRelatorioEquipe());

      expect(relatorio.totalMembros).toBe(2);
      expect(relatorio.custoTotalEstimado).toBe(3000 + 2000);
      expect(relatorio.membros.map((m) => m.nome).sort()).toEqual(['Diretor Um', 'Editor Um']);
    });
  });

  it('os três visitantes operam sobre a MESMA árvore sem alterar as entidades de domínio originais', () => {
    const arvore = montarArvoreCompleta();
    const diretorOriginal = arvore.equipe.get(PapelTecnico.DIRETOR)!;
    const nomeOriginal = diretorOriginal.nome;
    const precoOriginal = diretorOriginal.faixaDePreco.minimo;

    arvore.aceitar(new VisitanteValidacaoConsistencia());
    arvore.aceitar(new VisitanteMetricaCompatibilidade());
    arvore.aceitar(new VisitanteRelatorioEquipe());

    // As classes de domínio (Profissional) permanecem intactas após a visita:
    // nenhuma lógica de validação, métrica ou relatório foi injetada nelas.
    expect(diretorOriginal.nome).toBe(nomeOriginal);
    expect(diretorOriginal.faixaDePreco.minimo).toBe(precoOriginal);
  });
});
