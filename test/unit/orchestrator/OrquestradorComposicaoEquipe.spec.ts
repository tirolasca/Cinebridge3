import { OrquestradorPadrao } from '../../../src/application/orchestrator/OrquestradorPadrao';
import { OrquestradorReavaliacao } from '../../../src/application/orchestrator/OrquestradorReavaliacao';
import { EstrategiaSimilaridadeCosseno } from '../../../src/domain/strategies/EstrategiaSimilaridadeCosseno';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarCompetencia, criarProjeto } from '../../fixtures/builders';

describe('OrquestradorComposicaoEquipe (Template Method)', () => {
  const estrategia = new EstrategiaSimilaridadeCosseno();

  function candidatosPadrao(): Map<PapelTecnico, ReturnType<typeof criarProfissional>[]> {
    return new Map([
      [
        PapelTecnico.DIRETOR,
        [criarProfissional({ competencias: [criarCompetencia('direcao_atores', 0.9)] })]
      ],
      [
        PapelTecnico.EDITOR,
        [criarProfissional({ competencias: [criarCompetencia('edicao_avancada', 0.9)] })]
      ],
      [
        PapelTecnico.SONOPLASTA,
        [criarProfissional({ competencias: [criarCompetencia('mixagem_audio', 0.9)] })]
      ]
    ]);
  }

  describe('OrquestradorPadrao', () => {
    const orquestrador = new OrquestradorPadrao();

    it('gera uma recomendação completa quando há candidatos para todos os papéis', async () => {
      const projeto = criarProjeto();
      const recomendacao = await orquestrador.compor(projeto, estrategia, candidatosPadrao());

      expect(recomendacao.itens).toHaveLength(3);
      expect(recomendacao.parcial).toBe(false);
      expect(recomendacao.estrategiaUtilizada).toBe('similaridade_cosseno');
    });

    it('gera uma recomendação parcial quando falta candidato para algum papel', async () => {
      const projeto = criarProjeto();
      const candidatos = candidatosPadrao();
      candidatos.set(PapelTecnico.SONOPLASTA, []);

      const recomendacao = await orquestrador.compor(projeto, estrategia, candidatos);

      expect(recomendacao.itens).toHaveLength(2);
      expect(recomendacao.parcial).toBe(true);
    });

    it('rejeita projeto com orçamento zero (hook validarRestricoesOrcamentarias)', async () => {
      const projeto = criarProjeto({ orcamentoTotal: 0 });
      await expect(orquestrador.compor(projeto, estrategia, candidatosPadrao())).rejects.toThrow(
        /Orçamento total/
      );
    });

    it('rejeita projeto com data de entrega no passado (hook validarRestricoesOrcamentarias)', async () => {
      const projeto = criarProjeto({ dataEntrega: new Date('2020-01-01') });
      await expect(orquestrador.compor(projeto, estrategia, candidatosPadrao())).rejects.toThrow(
        /Data de entrega/
      );
    });

    it('remove profissionais duplicados na normalização (hook normalizarDadosDeEntrada)', async () => {
      const projeto = criarProjeto({
        papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
      });
      const profissional = criarProfissional({ competencias: [criarCompetencia('direcao_atores', 0.9)] });
      const candidatos = new Map([[PapelTecnico.DIRETOR, [profissional, profissional]]]);

      const recomendacao = await orquestrador.compor(projeto, estrategia, candidatos);

      // Apesar de duplicado, a recomendação final tem um único item para o papel.
      expect(recomendacao.itens).toHaveLength(1);
    });

    it('arredonda a pontuação para 2 casas decimais (hook posProcessarRecomendacoes)', async () => {
      const projeto = criarProjeto({
        papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
      });
      const profissional = criarProfissional({
        competencias: [criarCompetencia('direcao_atores', 0.333333)]
      });
      const candidatos = new Map([[PapelTecnico.DIRETOR, [profissional]]]);

      const recomendacao = await orquestrador.compor(projeto, estrategia, candidatos);

      const pontuacaoTexto = recomendacao.itens[0].pontuacao.toString();
      const casasDecimais = pontuacaoTexto.includes('.') ? pontuacaoTexto.split('.')[1].length : 0;
      expect(casasDecimais).toBeLessThanOrEqual(2);
    });
  });

  describe('OrquestradorReavaliacao', () => {
    const orquestrador = new OrquestradorReavaliacao();

    it('aceita projeto com data de entrega no passado (regra mais permissiva)', async () => {
      const projeto = criarProjeto({ dataEntrega: new Date('2020-01-01') });
      const recomendacao = await orquestrador.compor(projeto, estrategia, candidatosPadrao());
      expect(recomendacao.itens.length).toBeGreaterThan(0);
    });

    it('ainda assim rejeita orçamento zero (regra comum mantida)', async () => {
      const projeto = criarProjeto({ orcamentoTotal: 0 });
      await expect(orquestrador.compor(projeto, estrategia, candidatosPadrao())).rejects.toThrow(
        /Orçamento total/
      );
    });
  });

  it('invariância do fluxo: ambas as subclasses retornam uma Recomendacao com os mesmos campos estruturais', async () => {
    const projeto = criarProjeto();
    const padrao = new OrquestradorPadrao();
    const reavaliacao = new OrquestradorReavaliacao();

    const resultadoPadrao = await padrao.compor(projeto, estrategia, candidatosPadrao());
    const resultadoReavaliacao = await reavaliacao.compor(projeto, estrategia, candidatosPadrao());

    // O ESQUELETO do processo (validar -> normalizar -> ranquear -> pós-processar)
    // é o mesmo: ambos produzem uma Recomendacao com projetoId, estrategiaUtilizada,
    // itens e parcial, independentemente da subclasse concreta usada.
    for (const resultado of [resultadoPadrao, resultadoReavaliacao]) {
      expect(resultado.projetoId).toBe(projeto.id);
      expect(resultado.estrategiaUtilizada).toBe('similaridade_cosseno');
      expect(Array.isArray(resultado.itens)).toBe(true);
      expect(typeof resultado.parcial).toBe('boolean');
    }
  });
});
