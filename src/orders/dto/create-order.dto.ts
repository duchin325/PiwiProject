import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  EN_TRANSITO = 'en tránsito',
  ENTREGADO = 'entregado',
}

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  clientId: number;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @Type(() => Number)
  @IsNotEmpty()
  weight: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  volume: number;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  originAddress?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  amountToCollect?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
