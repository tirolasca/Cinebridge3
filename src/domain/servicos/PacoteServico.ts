import { ServicoAtomico } from './ServicoAtomico';
import { ModoExecucao, ResultadoValidacaoServico, ServicoProjeto } from './ServicoProjeto';

function contem(no: ServicoProjeto, alvo: ServicoProjeto): boolean {
  return no === alvo || no.listarSubservicos().some((filho) => contem(filho, alvo));
}

/**
 * Composite (composto): um pacote de serviços que pode conter serviços
 * atômicos e outros pacotes, em qualquer profundidade. Custo, prazo e
 * validação são propagados recursivamente pelos subserviços.
 */
export class PacoteServico implements ServicoProjeto {
  private readonly servicos: ServicoProjeto[] = [];

  constructor(
    readonly nome: string,
    readonly modoExecucao: ModoExecucao = ModoExecucao.SEQUENCIAL,
    servicos: ServicoProjeto[] = []
  ) {
    servicos.forEach((servico) => this.adicionar(servico));
  }

  /** Adiciona um subserviço. Recusa ciclos (um pacote dentro dele mesmo). */
  adicionar(servico: ServicoProjeto): this {
    if (contem(servico, this)) {
      throw new Error(`O pacote "${this.nome}" não pode conter a si mesmo, direta ou indiretamente.`);
    }
    this.servicos.push(servico);
    return this;
  }

  remover(servico: ServicoProjeto): boolean {
    const indice = this.servicos.indexOf(servico);
    if (indice < 0) return false;
    this.servicos.splice(indice, 1);
    return true;
  }

  calcularCusto(): number {
    return this.servicos.reduce((total, servico) => total + servico.calcularCusto(), 0);
  }

  listarSubservicos(): ReadonlyArray<ServicoProjeto> {
    return [...this.servicos];
  }

  obterPrazo(): number {
    const prazos = this.servicos.map((servico) => servico.obterPrazo());
    if (prazos.length === 0) return 0;
    return this.modoExecucao === ModoExecucao.PARALELO
      ? Math.max(...prazos)
      : prazos.reduce((soma, prazo) => soma + prazo, 0);
  }

  listarAtomicos(): ReadonlyArray<ServicoAtomico> {
    return this.servicos.flatMap((servico) => servico.listarAtomicos());
  }

  validar(): ResultadoValidacaoServico {
    const erros: string[] = [];

    if (!this.nome || this.nome.trim().length === 0) {
      erros.push('Pacote de serviços sem nome.');
    }
    if (this.servicos.length === 0) {
      erros.push(`Pacote "${this.nome}" não contém nenhum serviço.`);
    }

    // Um mesmo objeto presente duas vezes na árvore teria custo e prazo contados em dobro.
    const vistos = new Set<ServicoProjeto>();
    for (const servico of this.servicos) {
      if (vistos.has(servico)) {
        erros.push(`Pacote "${this.nome}": o serviço "${servico.nome}" aparece mais de uma vez.`);
        continue;
      }
      vistos.add(servico);
      for (const erro of servico.validar().erros) {
        erros.push(`${this.nome} › ${erro}`);
      }
    }

    return { valido: erros.length === 0, erros };
  }

  clonar(): PacoteServico {
    return new PacoteServico(
      this.nome,
      this.modoExecucao,
      this.servicos.map((servico) => servico.clonar())
    );
  }
}
