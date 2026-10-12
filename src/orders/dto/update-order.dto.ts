import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateOrderDto, OrderStatus } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  // Solo se puede cambiar a mano entre pendiente y cancelado (lo valida el service);
  // el resto de los estados los maneja el ciclo de vida de la salida.
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
