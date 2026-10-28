import { ChildEntity, Column } from 'typeorm';
import { Projeto, DadosProjeto } from './Projeto';
import { TipoProjeto } from './types';

/**
 * Projeto do tipo animação. Atributos específicos refletem critérios
 * próprios do gênero: técnica de animação (2D, 3D, stop-motion) e software
 * de referência, usados pelo recomendador desta família de objetos para
 * priorizar habilidades em modelagem/renderização (ver FabricaAnimacao).
 */
@ChildEntity(TipoProjeto.ANIMACAO)
export class ProjetoAnimacao extends Projeto {
  readonly tipoProjeto = TipoProjeto.ANIMACAO;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tecnicaAnimacao!: string; // ex: '2D', '3D', 'STOP_MOTION'

  @Column({ type: 'varchar', length: 100, nullable: true })
  softwarePrincipal!: string; // ex: 'Blender', 'Maya', 'Toon Boom'

  constructor(parcial?: DadosProjeto<ProjetoAnimacao>) {
    super(parcial);
  }

  clonar(): ProjetoAnimacao {
    return new ProjetoAnimacao({
      ...this.clonarCamposBase(),
      tecnicaAnimacao: this.tecnicaAnimacao,
      softwarePrincipal: this.softwarePrincipal
    });
  }
}
