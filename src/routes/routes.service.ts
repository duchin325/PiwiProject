import { Inject, Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Route } from './route.interface';

@Injectable()
export class RoutesService {
    constructor (
        @Inject('DATABASE_CONNECTION')
        private readonly pool: ConnectionPool
    ) {}

    async findAll(): Promise<Route []> {
        const result = await this.pool
                .request()
                .query('SELECT * FROM Routes')
        return result.recordset;
    }
    
    async findOne( id: number ): Promise<Route | null> {
        const result = await this.pool
                .request()
                .input('id', id)
                .query(`SELECT * FROM Routes WHERE id = @id`);
        return result.recordset[0] || null;
    }
    
    async create(data: Omit<Route, 'id' | 'createdAt'>): Promise<number> {
        const { tripId, routeGeoJson, pdfUrl } = data;
        const result = await this.pool
                    .request()
                    .input('tripId', tripId)
                    .input('routeGeoJson', routeGeoJson)
                    .input('pdfUrl', pdfUrl)
                    .query(`
                            INSERT INTO Routes (tripId, routeGeoJson, pdfUrl)
                            OUTPUT INSERTED.id
                            VALUES (@tripId, @routeGeoJson, @pdfUrl)
                        `);
            return result.recordset[0].id;
        }
    
        async update(id: number, data: Partial<Omit<Route, 'id' | 'createdAt'>>): Promise<void> {
            const sets = Object.keys(data)
                .map((key) => `${key} = @${key}`)
                .join(', ');
            
            const req = this.pool
                .request()
                .input('id', id);
            for(const [k, v] of Object.entries(data)) {
                req.input(k, v);
            }
    
            await req.query(`
                    UPDATE Routes
                    SET ${sets}
                    WHERE id = @id
                `);
        }
    
        async remove(id: number): Promise<void> {
            await this.pool
            .request()
            .input('id', id)
            .query(`
                    DELETE FROM Routes WHERE id = @id
                `);
        }
}
