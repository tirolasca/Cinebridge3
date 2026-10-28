import { ChildEntity, Column } from 'typeorm';
import { Projeto, DadosProjeto } from './Projeto';
import { TipoProjeto } from './types';

/**
 * Projeto do tipo documentário. Atributos específicos refletem critérios
 * próprios do gênero: tema central e lista de entrevistados previstos,
 * usados pelo validador e pelo recomendador desta família de objetos
 * (ver FabricaDocumentario).
 */
@ChildEntity(TipoProjeto.DOCUMENTARIO)
export class ProjetoDocumentario extends Projeto {
  readonly tipoProjeto = TipoProjeto.DOCUMENTARIO;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tema!: string;

  @Column({ type: 'simple-array', default: '' })
  entrevistados!: string[];

  constructor(parcial?: DadosProjeto<ProjetoDocumentario>) {
    super(parcial);
    if (!this.entrevistados) this.entrevistados = [];
  }

  clonar(): ProjetoDocumentario {
    return new ProjetoDocumentario({
      ...this.clonarCamposBase(),
      tema: this.tema,
      entrevistados: [...this.entrevistados]
    });
  }
}
