import { DataSource } from 'typeorm';
import { RepositorioProfissionaisCompleto } from '../../application/services/RepositorioProfissionais';
import { AvaliacaoDeProfissional } from '../../application/ports/AdaptadorProfissional';
import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Profissional } from '../../domain/entities/Profissional';
import { PapelTecnico } from '../../domain/entities/types';

/**
 * Implementação de infraestrutura da porta RepositorioProfissionaisCompleto
 * usando TypeORM/PostgreSQL. Mantém a camada de aplicação desacoplada de
 * detalhes de persistência (inversão de dependência).
 */
export class RepositorioProfissionaisTypeOrm implements RepositorioProfissionaisCompleto {
  constructor(private readonly dataSource: DataSource) {}

  async buscarPorPapel(papel: PapelTecnico): Promise<Profissional[]> {
    const repositorio = this.dataSource.getRepository(Profissional);
    return repositorio.find({
      where: { especialidadePrincipal: papel },
      relations: { competencias: true, avaliacoes: true }
    });
  }

  async buscarPorId(id: string): Promise<Profissional | null> {
    return this.dataSource.getRepository(Profissional).findOne({
      where: { id },
      relations: { competencias: true, avaliacoes: true }
    });
  }

  async registrarAvaliacao(profissionalId: string, avaliacao: AvaliacaoDeProfissional): Promise<boolean> {
    const profissional = await this.buscarPorId(profissionalId);
    if (!profissional) return false;

    const nova = new Avaliacao(avaliacao.nota, avaliacao.projetoId, avaliacao.comentario ?? null);
    nova.profissional = profissional;
    await this.dataSource.getRepository(Avaliacao).save(nova);
    return true;
  }
}
