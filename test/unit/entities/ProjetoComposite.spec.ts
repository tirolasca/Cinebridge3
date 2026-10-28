import { ProjetoDocumentario } from '../../../src/domain/entities/ProjetoDocumentario';
import { PapelTecnico, TipoCaptacao } from '../../../src/domain/entities/types';
import { PacoteServico } from '../../../src/domain/servicos/PacoteServico';
import { ServicoAtomico } from '../../../src/domain/servicos/ServicoAtomico';
import { ModoExecucao } from '../../../src/domain/servicos/ServicoProjeto';
import { dataFutura } from '../../fixtures/builders';

function criar(parcial: ConstructorParameters<typeof ProjetoDocumentario>[0] = {}) {
  return new ProjetoDocumentario({
    titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 40, orcamentoTotal: 20000,
    dataEntrega: dataFutura(90), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
    localizacao: { latitude: 0, longitude: 0, cidade: 'X' }, produtorId: 'p1',
    tema: 'Tema', entrevistados: ['A'],
    ...parcial
  });
}

const posProducao = () =>
  new PacoteServico('Pós-produção', ModoExecucao.SEQUENCIAL, [
    new ServicoAtomico('Edição', PapelTecnico.EDITOR, 6000, 10),
    new ServicoAtomico('Mixagem', PapelTecnico.SONOPLASTA, 4000, 5)
  ]);

describe('Projeto com servicoPrincipal (Composite)', () => {
  it('delega custo total e prazo ao serviço principal', () => {
    const projeto = criar({
      servicoPrincipal: new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
        posProducao(),
        new ServicoAtomico('Direção', PapelTecnico.DIRETOR, 8000, 20)
      ])
    });

    expect(projeto.calcularCustoTotal()).toBe(18000);
    expect(projeto.obterPrazoTotalDias()).toBe(35);
  });

  it('deriva os papéis requeridos das folhas da hierarquia, com peso pela fatia de custo', () => {
    const projeto = criar({ servicoPrincipal: posProducao() });

    expect(projeto.papeisRequeridos.map((p) => p.papel)).toEqual([PapelTecnico.EDITOR, PapelTecnico.SONOPLASTA]);
    expect(projeto.orcamentoMaximoParaPapel(PapelTecnico.EDITOR)).toBeCloseTo(12000, 6); // 60% de 20000
    expect(projeto.orcamentoMaximoParaPapel(PapelTecnico.SONOPLASTA)).toBeCloseTo(8000, 6);
  });

  it('aceita a lista simples de papéis como atalho, convertendo-a em serviços atômicos', () => {
    const projeto = criar({
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.75 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 0.25 }
      ]
    });

    expect(projeto.servicoPrincipal).toBeInstanceOf(PacoteServico);
    expect(projeto.servicoPrincipal.listarAtomicos()).toHaveLength(2);
    expect(projeto.calcularCustoTotal()).toBeCloseTo(20000, 6);
  });

  it('servicoPrincipal prevalece quando a lista de papéis também é informada', () => {
    const projeto = criar({
      servicoPrincipal: posProducao(),
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });

    expect(projeto.papeisRequeridos.map((p) => p.papel)).not.toContain(PapelTecnico.DIRETOR);
  });

  it('sem serviços nem papéis, o projeto tem um pacote vazio', () => {
    const projeto = criar();
    expect(projeto.papeisRequeridos).toEqual([]);
    expect(projeto.calcularCustoTotal()).toBe(0);
  });

  describe('validarEstrutura()', () => {
    it('aprova um projeto coerente', () => {
      expect(criar({ servicoPrincipal: posProducao() }).validarEstrutura()).toEqual({ valido: true, erros: [] });
    });

    it('inclui os erros da hierarquia, em qualquer profundidade', () => {
      const projeto = criar({
        servicoPrincipal: new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
          new PacoteServico('Pós', ModoExecucao.SEQUENCIAL, [
            new ServicoAtomico('Edição', 'COZINHEIRO' as PapelTecnico, 100, 1)
          ])
        ])
      });

      const resultado = projeto.validarEstrutura();

      expect(resultado.valido).toBe(false);
      expect(resultado.erros.join(' ')).toMatch(/Projeto › Pós › Serviço "Edição": papel técnico inválido/);
    });

    it('reprova quando o prazo planejado não cabe até a data de entrega', () => {
      const projeto = criar({ dataEntrega: dataFutura(10), servicoPrincipal: posProducao() }); // precisa de 15 dias

      const resultado = projeto.validarEstrutura();

      expect(resultado.valido).toBe(false);
      expect(resultado.erros.join(' ')).toMatch(/prazo planejado \(15 dias\) excede/);
    });

    it('em modo PARALELO o mesmo projeto cabe no prazo', () => {
      const paralelo = new PacoteServico('Pós', ModoExecucao.PARALELO, [...posProducao().listarSubservicos()]);
      const projeto = criar({ dataEntrega: dataFutura(12), servicoPrincipal: paralelo }); // precisa de 10 dias

      expect(projeto.validarEstrutura().valido).toBe(true);
    });

    it('reprova quando o custo planejado excede o orçamento', () => {
      const projeto = criar({ orcamentoTotal: 5000, servicoPrincipal: posProducao() }); // custa 10000

      const resultado = projeto.validarEstrutura();

      expect(resultado.valido).toBe(false);
      expect(resultado.erros.join(' ')).toMatch(/custo planejado \(R\$ 10000\.00\) excede o orçamento/);
    });
  });

  it('clonar() duplica a hierarquia: alterar o clone não altera o original', () => {
    const original = criar({ servicoPrincipal: posProducao() });
    const clone = original.clonar();

    (clone.servicoPrincipal as PacoteServico).adicionar(new ServicoAtomico('VFX', PapelTecnico.ESPECIALISTA_VFX, 1, 1));

    expect(clone.servicoPrincipal).not.toBe(original.servicoPrincipal);
    expect(original.servicoPrincipal.listarAtomicos()).toHaveLength(2);
    expect(clone.servicoPrincipal.listarAtomicos()).toHaveLength(3);
  });
});
