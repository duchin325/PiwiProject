import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  ASIGNADA = 'asignada',
  EN_TRANSITO = 'en tránsito',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

// Largos segun sql/000_baseline.sql (tabla Orders).
// `status` no forma parte del alta: toda orden nace `pendiente`.
export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  clientId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  origin: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  destination: string;

  @Type(() => Number)
  @IsNotEmpty()
  weight: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  volume: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  originAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  destinationAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  senderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientPhone?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountToCollect?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
