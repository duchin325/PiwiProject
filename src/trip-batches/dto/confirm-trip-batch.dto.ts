import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripBatchDirection } from './create-trip-batch.dto';
import { TripStopType } from '../../trip-stops/trip-stop.interface';

export class ConfirmTripBatchStopDto {
  @Type(() => Number)
  @IsInt()
  orderId: number;

  @Type(() => Number)
  @IsInt()
  sequence: number;

  @IsIn(['pickup', 'delivery', 'checkpoint', 'other'] as TripStopType[])
  stopType: TripStopType;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsBoolean()
  cashOnDelivery: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmTripBatchGroupDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @Type(() => Number)
  @IsInt()
  routeOrder: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Cada grupo debe tener al menos una parada' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmTripBatchStopDto)
  stops: ConfirmTripBatchStopDto[];
}

export class ConfirmTripBatchDto {
  @IsDateString()
  tripDate: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeName?: string;

  @IsEnum(TripBatchDirection)
  direction: TripBatchDirection;

  @IsString()
  @IsNotEmpty()
  originCity: string;

  @IsString()
  @IsNotEmpty()
  finalDestinationCity: string;

  @Type(() => Number)
  @IsInt()
  driverId: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'La salida debe tener al menos un grupo' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmTripBatchGroupDto)
  groups: ConfirmTripBatchGroupDto[];
}
