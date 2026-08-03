import { PartialType } from '@nestjs/mapped-types';
import { CreateTripBatchDto } from './create-trip-batch.dto';

export class UpdateTripBatchDto extends PartialType(CreateTripBatchDto) {}
