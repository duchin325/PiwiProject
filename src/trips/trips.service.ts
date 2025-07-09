import { Inject ,Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Trip } from './trip.interface';

@Injectable()
export class TripsService {
    constructor(
        @Inject('DATABASE_CONNECTION')
        private readonly pool: ConnectionPool
    ) {}

    async findAll(): Promise<Trip[]> {
        const result = await this.pool
            .request()
            .query('SELECT * FROM Trips')
        return result.recordset;
    }

    async findOne( id:number ): Promise<Trip | null> {
        const result = await this.pool
            .request()
            .input('id', id)
            .query(`SELECT * FROM Trips WHERE id = @id`)
        return result.recordset[0] || null;
    }

    async create( data: Omit<Trip, 'id' | 'createdAt'>): Promise<number> {
        const { tripDate, vehicle, driver, status } = data;
        const result = await this.pool
            .request()
            .input('tripDate', tripDate)
            .input('vehicle', vehicle)
            .input('driver', driver)
            .input('status', status)
            .query(`INSERT INTO Trips (tripDate, vehicle, driver, status) OUTPUT INSERTED.id VALUES (@tripDate, @vehicle, @driver, @status)`)
        return result.recordset[0].id;

    }

    async update( id: number, data: Partial<Omit<Trip, 'id' | 'createdAt'>>): Promise<string>{

        const sets = Object.keys(data)
            .map((key) => `${key} = @${key}`)
            .join(', ')

        const req = this.pool
            .request()
            .input('id', id);
        for (const [k,v] of Object.entries(data)) {
            req.input(k, v);
        }

        await req.query(`UPDATE Trips SET ${sets} WHERE id = @id`);


        return "Actualizado";
    }

    async remove(id: number): Promise<void> {
        await this.pool
            .request()
            .input('id', id)
            .query(`DELETE FROM Trips WHERE id = @id`);
    }
}
