import { PapelTecnico } from '../entities/types';
import { ResultadoValidacaoServico, ServicoProjeto } from './ServicoProjeto';

/**
 * Composite (folha): um serviço individual — por exemplo, edição de vídeo ou
 * mixagem de áudio — com custo, prazo e o papel técnico responsável por ele.
 */
export class ServicoAtomico implements ServicoProjeto {
  constructor(
    readonly nome: string,
    readonly papel: PapelTecnico,
    readonly custo: number,
    readonly prazoDias: number
  ) {}

  calcularCusto(): number {
    return this.custo;
  }

  listarSubservicos(): ReadonlyArray<ServicoProjeto> {
    return [];
  }

  obterPrazo(): number {
    return this.prazoDias;
  }

  listarAtomicos(): ReadonlyArray<ServicoAtomico> {
    return [this];
  }

  validar(): ResultadoValidacaoServico {
    const erros: string[] = [];
    const rotulo = this.nome?.trim() ? `Serviço "${this.nome}"` : 'Serviço sem nome';

    if (!this.nome || this.nome.trim().length === 0) {
      erros.push('Serviço sem nome.');
    }
    if (!Object.values(PapelTecnico).includes(this.papel)) {
      erros.push(`${rotulo}: papel técnico inválido ("${String(this.papel)}").`);
    }
    if (!Number.isFinite(this.custo) || this.custo < 0) {
      erros.push(`${rotulo}: o custo deve ser um número maior ou igual a zero.`);
    }
    if (!Number.isInteger(this.prazoDias) || this.prazoDias < 1) {
      erros.push(`${rotulo}: o prazo deve ser um número inteiro de dias, de no mínimo 1.`);
    }

    return { valido: erros.length === 0, erros };
  }

  clonar(): ServicoAtomico {
    return new ServicoAtomico(this.nome, this.papel, this.custo, this.prazoDias);
  }
}
