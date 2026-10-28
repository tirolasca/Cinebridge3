import { Profissional } from '../../domain/entities/Profissional';
import { PapelTecnico } from '../../domain/entities/types';
import { AvaliacaoDeProfissional } from '../ports/AdaptadorProfissional';

/**
 * Porta (interface) de acesso ao repositório de profissionais, seguindo
 * inversão de dependência: a camada de aplicação depende desta abstração,
 * e a infraestrutura (TypeORM/PostgreSQL) fornece a implementação concreta.
 */
export interface RepositorioProfissionais {
  buscarPorPapel(papel: PapelTecnico): Promise<Profissional[]>;
}

/**
 * Repositório interno completo: além da busca por papel, permite detalhar um
 * profissional e registrar avaliações. É o que o `AdaptadorInterno` adapta.
 */
export interface RepositorioProfissionaisCompleto extends RepositorioProfissionais {
  buscarPorId(id: string): Promise<Profissional | null>;
  /** `false` se o profissional não existir. */
  registrarAvaliacao(profissionalId: string, avaliacao: AvaliacaoDeProfissional): Promise<boolean>;
}
