import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { OrderTrip } from './order-trip.interface';

const SQL_ERROR_UNIQUE_VIOLATION = [2627, 2601];
const SQL_ERROR_FK_VIOLATION = 547;

@Injectable()
export class OrderTripService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<OrderTrip[]> {
    const result = await this.pool.request().query('SELECT * FROM Order_Trip');
    return result.recordset;
  }

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

  async create(data: OrderTrip): Promise<OrderTrip> {
    const { orderId, tripId } = data;

    try {
      await this.pool
        .request()
        .input('orderId', orderId)
        .input('tripId', tripId).query(`
          INSERT INTO Order_Trip (orderId, tripId)
          VALUES (@orderId, @tripId)
        `);
    } catch (err) {
      const sqlError = err as { number?: number };
      if (
        sqlError.number &&
        SQL_ERROR_UNIQUE_VIOLATION.includes(sqlError.number)
      ) {
        throw new ConflictException(
          `La orden ${orderId} ya está asociada al viaje ${tripId}`,
        );
      }
      if (sqlError.number === SQL_ERROR_FK_VIOLATION) {
        throw new BadRequestException(
          `orderId ${orderId} o tripId ${tripId} no existen`,
        );
      }
      throw err;
    }

    return { orderId, tripId };
  }

  async remove(orderId: number, tripId: number): Promise<void> {
    await this.pool.request().input('orderId', orderId).input('tripId', tripId)
      .query(`
                     DELETE FROM Order_Trip WHERE orderId = @orderId AND tripId = @tripId
            `);
  }
}
