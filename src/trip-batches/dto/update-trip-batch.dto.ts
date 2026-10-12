import { PartialType } from '@nestjs/mapped-types';
import { CreateTripBatchDto } from './create-trip-batch.dto';

// El status no se edita ni se elige al crear: nace `draft` y cambia solo por
// PATCH /trip-batches/:id/status.
export class UpdateTripBatchDto extends PartialType(CreateTripBatchDto) {}
