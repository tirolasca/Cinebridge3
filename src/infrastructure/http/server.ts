import 'reflect-metadata';
import Fastify from 'fastify';
import { AppDataSource } from '../persistence/data-source';
import { montarContainer } from './container';
import { registrarRotas } from './routes';

async function iniciar(): Promise<void> {
  const app = Fastify({ logger: true });

  await AppDataSource.initialize();
  app.log.info('Conexão com PostgreSQL estabelecida.');

  const container = montarContainer(AppDataSource);
  await registrarRotas(app, container);

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen({ port: porta, host: '0.0.0.0' });
}

iniciar().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar o microsserviço:', erro);
  process.exit(1);
});
