import { Inject, Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Order } from './order.interface';

@Injectable()
export class OrdersService {
    constructor(
        @Inject('DATABASE_CONNECTION')
        private readonly pool: ConnectionPool
    ) {}

    async findAll(): Promise<Order []> {
        const result = await this.pool
                .request()
                .query('SELECT * FROM Orders')
        return result.recordset;
    }

    async findOne( id: number ): Promise<Order | null> {
        const result = await this.pool
                .request()
                .input('id', id)
                .query(`SELECT * FROM Orders WHERE id = @id`);
        return result.recordset[0] || null;
    }

    async create(data: Omit<Order, 'id' | 'createdAt'>): Promise<number> {
        const { clientId, origin, destination, weight, volume, status } = data;
        const result = await this.pool
                .request()
                .input('clientId', clientId)
                .input('origin', origin)
                .input('destination', destination)
                .input('weight', weight)
                .input('volume', volume)
                .input('status', status)
                .query(`
                        INSERT INTO Orders (clientId, origin, destination, weight, volume, status)
                        OUTPUT INSERTED.id
                        VALUES (@clientId, @origin, @destination, @weight, @volume, @status)
                    `);
        return result.recordset[0].id;
    }

    async update(id: number, data: Partial<Omit<Order, 'id' | 'createdAt'>>): Promise<void> {
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
                UPDATE Orders
                SET ${sets}
                WHERE id = @id
            `);
    }

    async remove(id: number): Promise<void> {
        await this.pool
        .request()
        .input('id', id)
        .query(`
                DELETE FROM Orders WHERE id = @id
            `);
    }

}
