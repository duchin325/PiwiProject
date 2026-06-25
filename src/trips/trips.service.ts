import { Inject, Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Trip } from './trip.interface';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<Trip[]> {
    const result = await this.pool.request().query(`
      SELECT
        id,
        COALESCE(departureTime, CAST(tripDate AS datetime2)) AS date,
        driverId,
        origin,
        destination,
        status,
        notes,
        departureTime,
        createdAt
      FROM Trips
      ORDER BY COALESCE(departureTime, CAST(tripDate AS datetime2)) DESC
    `);

    return result.recordset;
  }

  async findOne(id: number): Promise<Trip | null> {
    const result = await this.pool.request().input('id', id).query(`
        SELECT
          id,
          COALESCE(departureTime, CAST(tripDate AS datetime2)) AS date,
          driverId,
          origin,
          destination,
          status,
          notes,
          departureTime,
          createdAt
        FROM Trips
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  async create(data: CreateTripDto): Promise<number> {
    const tripDate = data.date.slice(0, 10);
    const departureTime = data.date;
    const result = await this.pool
      .request()
      .input('tripDate', tripDate)
      .input('departureTime', departureTime)
      .input('driverId', data.driverId ?? null)
      .input('origin', data.origin)
      .input('destination', data.destination)
      .input('status', data.status)
      .input('notes', data.notes ?? null).query(`
        INSERT INTO Trips (
          tripDate,
          vehicle,
          driver,
          driverId,
          origin,
          destination,
          status,
          notes,
          departureTime
        )
        OUTPUT INSERTED.id
        VALUES (
          @tripDate,
          NULL,
          NULL,
          @driverId,
          @origin,
          @destination,
          @status,
          @notes,
          @departureTime
        )
      `);

    return result.recordset[0].id;
  }

  async update(id: number, data: UpdateTripDto): Promise<string> {
    const sets: string[] = [];
    const req = this.pool.request().input('id', id);

    if (data.date !== undefined) {
      sets.push('tripDate = @tripDate', 'departureTime = @departureTime');
      req.input('tripDate', data.date.slice(0, 10));
      req.input('departureTime', data.date);
    }

    if (data.driverId !== undefined) {
      sets.push('driverId = @driverId');
      req.input('driverId', data.driverId);
    }

    if (data.origin !== undefined) {
      sets.push('origin = @origin');
      req.input('origin', data.origin);
    }

    if (data.destination !== undefined) {
      sets.push('destination = @destination');
      req.input('destination', data.destination);
    }

    if (data.status !== undefined) {
      sets.push('status = @status');
      req.input('status', data.status);
    }

    if (data.notes !== undefined) {
      sets.push('notes = @notes');
      req.input('notes', data.notes);
    }

    if (sets.length === 0) {
      return 'Actualizado';
    }

    await req.query(`UPDATE Trips SET ${sets.join(', ')} WHERE id = @id`);
    return 'Actualizado';
  }

  async remove(id: number): Promise<void> {
    await this.pool
      .request()
      .input('id', id)
      .query('DELETE FROM Trips WHERE id = @id');
  }
}
