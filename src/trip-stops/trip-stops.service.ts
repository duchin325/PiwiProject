import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { CreateTripStopDto } from './dto/create-trip-stop.dto';
import { UpdateTripStopDto } from './dto/update-trip-stop.dto';
import { TripStop } from './trip-stop.interface';

const MANUAL_ORDER_ASSIGNMENT_MESSAGE =
  'La asignación manual de encomiendas a hojas de ruta todavía no está soportada. Usá el flujo de Salidas por ciudad.';

@Injectable()
export class TripStopsService {
  private readonly logger = new Logger(TripStopsService.name);

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<TripStop[]> {
    const result = await this.pool
      .request()
      .query('SELECT * FROM TripStops ORDER BY tripId, sequence');
    return result.recordset;
  }

  async findOne(id: number): Promise<TripStop | null> {
    const result = await this.pool
      .request()
      .input('id', id)
      .query('SELECT * FROM TripStops WHERE id = @id');

    return result.recordset[0] || null;
  }

  async findByTrip(tripId: number): Promise<TripStop[]> {
    const result = await this.pool
      .request()
      .input('tripId', tripId)
      .query(
        'SELECT * FROM TripStops WHERE tripId = @tripId ORDER BY sequence',
      );

    return result.recordset;
  }

  async create(data: CreateTripStopDto): Promise<number> {
    if (data.orderId !== null && data.orderId !== undefined) {
      throw new BadRequestException(MANUAL_ORDER_ASSIGNMENT_MESSAGE);
    }

    const result = await this.pool
      .request()
      .input('tripId', data.tripId)
      .input('orderId', data.orderId ?? null)
      .input('sequence', data.sequence)
      .input('name', data.name)
      .input('stopType', data.stopType)
      .input('city', data.city)
      .input('address', data.address ?? null)
      .input('contactName', data.contactName ?? null)
      .input('contactPhone', data.contactPhone ?? null)
      .input('scheduledTime', data.scheduledTime ?? null)
      .input('notes', data.notes ?? null)
      .input('cashOnDelivery', data.cashOnDelivery ?? false)
      .input('cashAmount', data.cashAmount ?? null)
      .input('completed', data.completed ?? false).query(`
        INSERT INTO TripStops (
          tripId,
          orderId,
          sequence,
          name,
          stopType,
          city,
          address,
          contactName,
          contactPhone,
          scheduledTime,
          notes,
          cashOnDelivery,
          cashAmount,
          completed
        )
        OUTPUT INSERTED.id
        VALUES (
          @tripId,
          @orderId,
          @sequence,
          @name,
          @stopType,
          @city,
          @address,
          @contactName,
          @contactPhone,
          @scheduledTime,
          @notes,
          @cashOnDelivery,
          @cashAmount,
          @completed
        )
      `);

    return result.recordset[0].id;
  }

  async update(id: number, dto: UpdateTripStopDto): Promise<void> {
    if (Object.prototype.hasOwnProperty.call(dto, 'orderId')) {
      throw new BadRequestException(MANUAL_ORDER_ASSIGNMENT_MESSAGE);
    }

    const sets = Object.keys(dto);
    if (sets.length === 0) return;

    const setClause = sets.map((key) => `${key} = @${key}`).join(', ');

    // Al completar una parada de entrega con encomienda, la encomienda en
    // transito pasa a entregado en la misma transaccion.
    const tx = this.pool.transaction();
    await tx.begin();
    try {
      const req = tx.request().input('id', id);
      for (const set of sets) {
        req.input(set, dto[set]);
      }

      const result = await req.query(`
        UPDATE TripStops
        SET ${setClause}
        OUTPUT INSERTED.stopType, INSERTED.orderId, INSERTED.completed,
               DELETED.completed AS wasCompleted
        WHERE id = @id
      `);

      if (result.rowsAffected[0] === 0) {
        throw new NotFoundException(`Trip stop with id ${id} not found`);
      }

      const stop = result.recordset[0] as {
        stopType: string;
        orderId: number | null;
        completed: boolean;
        wasCompleted: boolean;
      };
      if (
        stop.completed &&
        !stop.wasCompleted &&
        stop.stopType === 'delivery' &&
        stop.orderId !== null
      ) {
        await tx
          .request()
          .input('orderId', stop.orderId)
          .query(
            `UPDATE Orders SET status = N'entregado' WHERE id = @orderId AND status = N'en tránsito'`,
          );
      }

      await tx.commit();
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // la transaccion ya pudo haber sido abortada
      }
      this.logger.error(`Error updating trip stop ${id}`, err.stack);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Unexpected error updating trip stop',
      );
    }
  }

  async remove(id: number): Promise<void> {
    await this.pool
      .request()
      .input('id', id)
      .query('DELETE FROM TripStops WHERE id = @id');
  }
}
