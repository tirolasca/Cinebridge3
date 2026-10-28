import { ChildEntity, Column } from 'typeorm';
import { Projeto, DadosProjeto } from './Projeto';
import { TipoProjeto } from './types';

/**
 * Projeto do tipo publicitário. Atributos específicos refletem critérios
 * próprios do gênero: marca anunciante e prazo de veiculação, usados pelo
 * validador desta família de objetos, tipicamente mais rígido quanto a
 * prazos do que os demais tipos (ver FabricaPublicitario).
 */
@ChildEntity(TipoProjeto.PUBLICITARIO)
export class ProjetoPublicitario extends Projeto {
  readonly tipoProjeto = TipoProjeto.PUBLICITARIO;

  @Column({ type: 'varchar', length: 150, nullable: true })
  marcaAnunciante!: string;

  @Column({ type: 'timestamp', nullable: true })
  dataVeiculacao!: Date;

  constructor(parcial?: DadosProjeto<ProjetoPublicitario>) {
    super(parcial);
  }

  clonar(): ProjetoPublicitario {
    return new ProjetoPublicitario({
      ...this.clonarCamposBase(),
      marcaAnunciante: this.marcaAnunciante,
      dataVeiculacao: this.dataVeiculacao ? new Date(this.dataVeiculacao) : this.dataVeiculacao
    });
  }
}
