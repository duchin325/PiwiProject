import { Inject, Injectable } from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { OrderTrip } from './order-trip.interface';

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
}
