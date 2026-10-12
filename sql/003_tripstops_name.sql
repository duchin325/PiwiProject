USE [PiwiDB];
GO

-- El frontend envia y muestra TripStops.name; la base real no tenia la columna.
-- Las paradas creadas por POST /trip-batches/confirm la completan (contacto o "Encomienda #id").
IF COL_LENGTH('dbo.TripStops', 'name') IS NULL
  ALTER TABLE [dbo].[TripStops] ADD [name] NVARCHAR(150) NULL;
GO
