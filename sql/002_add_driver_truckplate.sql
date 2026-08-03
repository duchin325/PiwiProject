USE [PiwiDB];
GO

IF COL_LENGTH('dbo.Drivers', 'truckPlate') IS NULL
  ALTER TABLE [dbo].[Drivers] ADD [truckPlate] NVARCHAR(30) NULL;
GO
