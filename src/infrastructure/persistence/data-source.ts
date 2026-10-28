import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Profissional } from '../../domain/entities/Profissional';
import { Competencia } from '../../domain/entities/Competencia';
import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Projeto } from '../../domain/entities/Projeto';
import { ProjetoDocumentario } from '../../domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../domain/entities/ProjetoPublicitario';
import { Recomendacao } from '../../domain/entities/Recomendacao';
import { Convite } from '../../domain/entities/Convite';

/**
 * Fonte de dados PostgreSQL via TypeORM. Parâmetros de conexão via variáveis
 * de ambiente, seguindo boas práticas de doze fatores (12-factor app).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'cinebridge',
  password: process.env.DB_PASSWORD ?? 'cinebridge',
  database: process.env.DB_NAME ?? 'cinebridge_recomendacao',
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    Profissional,
    Competencia,
    Avaliacao,
    Projeto,
    ProjetoDocumentario,
    ProjetoAnimacao,
    ProjetoPublicitario,
    Recomendacao,
    Convite
  ],
  migrations: ['dist/infrastructure/persistence/migrations/*.js']
});
