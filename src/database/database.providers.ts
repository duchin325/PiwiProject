import { Provider } from "@nestjs/common";
import * as sql from 'mssql';

export const databaseProviders: Provider[] = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async () => {
      const config: sql.config = {
        user: 'sa',
        password: 'clipper325',
        server: 'RODRIGO-PC\\SQLEXPRESS02',
        database: 'PiwiDB',
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      };

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

