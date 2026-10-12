import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Order } from './order.interface';
import { CreateOrderDto, OrderStatus } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<Order[]> {
    const result = await this.pool.request().query('SELECT * FROM Orders');
    return result.recordset;
  }

  async findOne(id: number): Promise<Order | null> {
    const result = await this.pool
      .request()
      .input('id', id)
      .query(`SELECT * FROM Orders WHERE id = @id`);
    return result.recordset[0] || null;
  }

  async create(data: CreateOrderDto): Promise<number> {
    const { clientId, origin, destination, weight, volume } = data;
    const result = await this.pool
      .request()
      .input('clientId', clientId)
      .input('origin', origin)
      .input('destination', destination)
      .input('weight', weight)
      .input('volume', volume ?? null)
      .input('status', OrderStatus.PENDIENTE)
      .input('originCity', data.originCity ?? null)
      .input('destinationCity', data.destinationCity ?? null)
      .input('originAddress', data.originAddress ?? null)
      .input('destinationAddress', data.destinationAddress ?? null)
      .input('senderName', data.senderName ?? null)
      .input('senderPhone', data.senderPhone ?? null)
      .input('recipientName', data.recipientName ?? null)
      .input('recipientPhone', data.recipientPhone ?? null)
      .input('amountToCollect', data.amountToCollect ?? null)
      .input('notes', data.notes ?? null).query(`
                        INSERT INTO Orders (
                          clientId, origin, destination, weight, volume, status,
                          originCity, destinationCity, originAddress, destinationAddress, senderName, senderPhone,
                          recipientName, recipientPhone, amountToCollect, notes
                        )
                        OUTPUT INSERTED.id
                        VALUES (
                          @clientId, @origin, @destination, @weight, @volume, @status,
                          @originCity, @destinationCity, @originAddress, @destinationAddress, @senderName, @senderPhone,
                          @recipientName, @recipientPhone, @amountToCollect, @notes
                        )
                    `);
    return result.recordset[0].id;
  }

  async update(id: number, data: UpdateOrderDto): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const sets = keys.map((key) => `${key} = @${key}`).join(', ');

    const tx = this.pool.transaction();
    await tx.begin();
    try {
      // El estado solo se cambia a mano entre pendiente y cancelado; el resto
      // lo maneja el ciclo de vida de la salida (confirmar/iniciar/completar/cancelar).
      if (data.status !== undefined) {
        const current = await tx
          .request()
          .input('id', id)
          .query(
            'SELECT status FROM Orders WITH (UPDLOCK, ROWLOCK) WHERE id = @id',
          );
        if (current.recordset.length === 0) {
          throw new NotFoundException(
            `La orden con el id ${id} no se encuentra`,
          );
        }
        const from = current.recordset[0].status as string;
        if (!this.canChangeStatusManually(from, data.status)) {
          throw new BadRequestException(
            `No se puede cambiar manualmente el estado de "${from}" a "${data.status}". Solo se permite pasar entre "pendiente" y "cancelado"; los demás estados los maneja la salida.`,
          );
        }
      }

      const req = tx.request().input('id', id);
      for (const [k, v] of Object.entries(data)) {
        req.input(k, v);
      }
      await req.query(`
                UPDATE Orders
                SET ${sets}
                WHERE id = @id
            `);
      await tx.commit();
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // la transaccion ya pudo haber sido abortada
      }
      throw err;
    }
  }

  private canChangeStatusManually(from: string, to: OrderStatus): boolean {
    if (from === (to as string)) return true;
    const manual: string[] = [OrderStatus.PENDIENTE, OrderStatus.CANCELADO];
    return manual.includes(from) && manual.includes(to);
  }

  async remove(id: number): Promise<void> {
    await this.pool.request().input('id', id).query(`
                DELETE FROM Orders WHERE id = @id
            `);
  }
}
