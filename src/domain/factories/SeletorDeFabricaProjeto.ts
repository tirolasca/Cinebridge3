import { FabricaProjeto } from './FabricaProjeto';
import { FabricaDocumentario } from './documentario/FabricaDocumentario';
import { FabricaAnimacao } from './animacao/FabricaAnimacao';
import { FabricaPublicitario } from './publicitario/FabricaPublicitario';
import { TipoProjeto } from '../entities/types';

/**
 * Factory Method: ponto único de resolução da fábrica concreta adequada a
 * um tipo de projeto. É este seletor — e não o orquestrador ou o motor de
 * recomendação — que concentra o único condicional baseado em tipo de
 * projeto existente no sistema: ao incorporar um novo tipo de projeto
 * (ex.: realidade virtual), basta registrar sua fábrica aqui, sem tocar em
 * nenhuma outra classe.
 */
export class SeletorDeFabricaProjeto {
  private readonly registro: Map<TipoProjeto, FabricaProjeto>;

  constructor() {
    this.registro = new Map<TipoProjeto, FabricaProjeto>([
      [TipoProjeto.DOCUMENTARIO, new FabricaDocumentario()],
      [TipoProjeto.ANIMACAO, new FabricaAnimacao()],
      [TipoProjeto.PUBLICITARIO, new FabricaPublicitario()]
    ]);
  }

  obterFabrica(tipoProjeto: TipoProjeto): FabricaProjeto {
    const fabrica = this.registro.get(tipoProjeto);
    if (!fabrica) {
      throw new Error(`Não há fábrica registrada para o tipo de projeto "${tipoProjeto}"`);
    }
    return fabrica;
  }

  tiposDisponiveis(): TipoProjeto[] {
    return Array.from(this.registro.keys());
  }
}
