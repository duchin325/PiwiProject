import { Provider } from '@nestjs/common';
import * as sql from 'mssql';

export const databaseProviders: Provider[] = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async () => {
      const host = process.env.DB_HOST ?? 'RODRIGO-PC';
      const instanceName = process.env.DB_INSTANCE_NAME ?? 'SQLEXPRESS02';
      const user = process.env.DB_USER;
      const password = process.env.DB_PASSWORD;

      if (!user || !password) {
        throw new Error(
          'DB_USER y DB_PASSWORD deben estar definidos en el .env',
        );
      }

      const config: sql.config = {
        user,
        password,
        server: instanceName ? `${host}\\${instanceName}` : host,
        database: process.env.DB_NAME ?? 'PiwiDB',
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate:
            process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
        },
      };

      if (process.env.DB_PORT) {
        config.port = Number(process.env.DB_PORT);
      }

      try {
        const pool = await sql.connect(config);
        console.log('✅ Conexión a SQL Server establecida (PiwiDB)');
        return pool;
      } catch (error) {
        console.error('❌ Error conectando a SQL Server:', error);
        throw error;
      }
    },
  },
];
