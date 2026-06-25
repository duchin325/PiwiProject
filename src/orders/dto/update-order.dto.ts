import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';

//Marco todas las propiedades de CreateOrderDto como opcionales
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
