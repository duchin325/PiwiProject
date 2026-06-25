import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderTripDto {
  @Type(() => Number)
  @IsInt()
  orderId: number;

  @Type(() => Number)
  @IsInt()
  tripId: number;
}
