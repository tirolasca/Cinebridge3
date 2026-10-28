import { EstrategiaOrcamentoReduzido } from '../../../src/domain/strategies/EstrategiaOrcamentoReduzido';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarAvaliacao, criarProjeto } from '../../fixtures/builders';

describe('EstrategiaOrcamentoReduzido', () => {
  const estrategia = new EstrategiaOrcamentoReduzido();

  it('possui o nome identificador correto', () => {
    expect(estrategia.nome).toBe('orcamento_reduzido');
  });

  it('prioriza o profissional mais barato entre os que atendem à nota mínima', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    const barato = criarProfissional({
      nome: 'Barato',
      faixaDePreco: { minimo: 1000, maximo: 2000 },
      avaliacoes: [criarAvaliacao(3)]
    });

    const caro = criarProfissional({
      nome: 'Caro',
      faixaDePreco: { minimo: 8000, maximo: 9000 },
      avaliacoes: [criarAvaliacao(3)]
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [caro, barato]);

    expect(resultado[0].profissional.nome).toBe('Barato');
  });

  it('exclui profissionais abaixo da nota mínima aceitável', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    const notaBaixa = criarProfissional({
      faixaDePreco: { minimo: 1000, maximo: 2000 },
      avaliacoes: [criarAvaliacao(1)]
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [notaBaixa]);

    expect(resultado).toHaveLength(0);
  });

  it('exclui profissionais cujo preço mínimo excede o orçamento máximo do papel', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 1000,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    const acimaDoOrcamento = criarProfissional({
      faixaDePreco: { minimo: 5000, maximo: 6000 },
      avaliacoes: []
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [acimaDoOrcamento]);

    expect(resultado).toHaveLength(0);
  });

  it('inclui profissionais sem histórico de avaliações (sem penalizar novatos)', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    const novato = criarProfissional({
      faixaDePreco: { minimo: 1000, maximo: 2000 },
      avaliacoes: []
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [novato]);

    expect(resultado).toHaveLength(1);
  });
});
