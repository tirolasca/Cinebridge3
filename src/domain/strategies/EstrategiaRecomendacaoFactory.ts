import { EstrategiaRecomendacao } from './EstrategiaRecomendacao';
import { EstrategiaSimilaridadeCosseno } from './EstrategiaSimilaridadeCosseno';
import { EstrategiaFiltragemColaborativa } from './EstrategiaFiltragemColaborativa';
import { EstrategiaOrcamentoReduzido } from './EstrategiaOrcamentoReduzido';

/**
 * Fábrica responsável por resolver o nome de uma estratégia (persistido no
 * Projeto ou informado pelo produtor) na respectiva implementação concreta
 * do Strategy. Centraliza o ponto de extensão para novas estratégias futuras.
 */
export class EstrategiaRecomendacaoFactory {
  private readonly registro: Map<string, EstrategiaRecomendacao>;

  constructor() {
    const estrategias: EstrategiaRecomendacao[] = [
      new EstrategiaSimilaridadeCosseno(),
      new EstrategiaFiltragemColaborativa(),
      new EstrategiaOrcamentoReduzido()
    ];
    this.registro = new Map(estrategias.map((e) => [e.nome, e]));
  }

  obter(nome: string): EstrategiaRecomendacao {
    const estrategia = this.registro.get(nome);
    if (!estrategia) {
      throw new Error(`Estratégia de recomendação desconhecida: "${nome}"`);
    }
    return estrategia;
  }

  listarNomesDisponiveis(): string[] {
    return Array.from(this.registro.keys());
  }
}
