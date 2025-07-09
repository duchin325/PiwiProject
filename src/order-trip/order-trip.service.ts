import { Inject, Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { OrderTrip } from './order-trip.interface';



@Injectable()
export class OrderTripService {
    constructor (
        @Inject('DATABASE_CONNECTION')
        private readonly pool: ConnectionPool
    ){}

    async findAll(): Promise<OrderTrip []> {
        const result = await this.pool
                .request()
                .query('SELECT * FROM Order_Trip')
        return result.recordset;
    }
        
    // async findOne( id: number ): Promise<OrderTrip | null> {
    //     const result = await this.pool
    //             .request()
    //             .input('id', id)
    //             .query(`SELECT * FROM Order_Trip WHERE id = @id`);
    //     return result.recordset[0] || null;
    // }

    async findOneByOrder(orderId: number): Promise<OrderTrip[]> {
        const { recordset } = await this.pool
            .request()
            .input('orderId', orderId)
            .query(`SELECT orderId, tripId FROM Order_Trip WHERE orderId = @orderId`);
        return recordset;
    }

       async findOneByTrip(tripId: number): Promise<OrderTrip[]> {
        const { recordset } = await this.pool
            .request()
            .input('tripId', tripId)
            .query(`SELECT orderId, tripId FROM Order_Trip WHERE tripId = @tripId`);
        return recordset;
    }


        
    async create(data: OrderTrip ): Promise<void>{
        const { orderId, tripId } = data;
        const result = await this.pool
                .request()
                .input('orderId', orderId)
                .input('tripId', tripId)
                .query(`
                        INSERT INTO Order_Trip (orderId, tripId)
                         VALUES (@orderId, @tripId)
                    `);
        return result.recordset[0].id;
    }
        
    async update(id: number, data: Partial<Omit<OrderTrip, 'id' | 'createdAt'>>): Promise<void> {
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
                     UPDATE Order_Trip
                     SET ${sets}
                     WHERE id = @id
                `);
        }
        
    async remove(orderId: number, tripId: number): Promise<void> {
        await this.pool
            .request()
            .input('orderId', orderId)
            .input('tripId', tripId)
            .query(`
                     DELETE FROM Order_Trip WHERE orderId = @orderId AND tripId = @tripId
            `);
    }
}
