import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ConfirmTripBatchStopDto } from './confirm-trip-batch-stop.dto';

export class ConfirmTripBatchGroupDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @Type(() => Number)
  @IsInt()
  routeOrder: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalOrders?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalCashAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmTripBatchStopDto)
  stops: ConfirmTripBatchStopDto[];
}
