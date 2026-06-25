USE [PiwiDB];
GO

IF OBJECT_ID('dbo.Drivers', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Drivers](
    [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(150) NOT NULL,
    [phone] NVARCHAR(50) NULL,
    [licenseNumber] NVARCHAR(100) NOT NULL,
    [truckPlate] NVARCHAR(30) NULL,
    [notes] NVARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [DF_Drivers_isActive] DEFAULT ((1)),
    [createdAt] DATETIME2(7) NOT NULL CONSTRAINT [DF_Drivers_createdAt] DEFAULT (sysutcdatetime())
  );

  CREATE UNIQUE INDEX [UX_Drivers_licenseNumber] ON [dbo].[Drivers]([licenseNumber]);
END
GO

IF COL_LENGTH('dbo.Trips', 'driverId') IS NULL
  ALTER TABLE [dbo].[Trips] ADD [driverId] INT NULL;
GO

IF COL_LENGTH('dbo.Trips', 'origin') IS NULL
  ALTER TABLE [dbo].[Trips] ADD [origin] NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.Trips', 'destination') IS NULL
  ALTER TABLE [dbo].[Trips] ADD [destination] NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.Trips', 'notes') IS NULL
  ALTER TABLE [dbo].[Trips] ADD [notes] NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.Trips', 'departureTime') IS NULL
  ALTER TABLE [dbo].[Trips] ADD [departureTime] DATETIME2(7) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Trips_Drivers'
)
BEGIN
  ALTER TABLE [dbo].[Trips]
    ADD CONSTRAINT [FK_Trips_Drivers]
    FOREIGN KEY ([driverId]) REFERENCES [dbo].[Drivers]([id]);
END
GO

IF EXISTS (
  SELECT 1 FROM sys.check_constraints WHERE name = 'chk_trip_status'
)
BEGIN
  ALTER TABLE [dbo].[Trips] DROP CONSTRAINT [chk_trip_status];
END
GO

ALTER TABLE [dbo].[Trips] ALTER COLUMN [vehicle] NVARCHAR(100) NULL;
GO

ALTER TABLE [dbo].[Trips] ALTER COLUMN [driver] NVARCHAR(100) NULL;
GO

ALTER TABLE [dbo].[Trips] ALTER COLUMN [status] NVARCHAR(20) NOT NULL;
GO

ALTER TABLE [dbo].[Trips] WITH CHECK ADD CONSTRAINT [chk_trip_status]
CHECK (([status]='scheduled' OR [status]='in_transit' OR [status]='delivered' OR [status]='canceled'));
GO

ALTER TABLE [dbo].[Trips] CHECK CONSTRAINT [chk_trip_status];
GO

IF COL_LENGTH('dbo.Orders', 'originAddress') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [originAddress] NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'destinationAddress') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [destinationAddress] NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'senderName') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [senderName] NVARCHAR(150) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'senderPhone') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [senderPhone] NVARCHAR(50) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'recipientName') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [recipientName] NVARCHAR(150) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'recipientPhone') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [recipientPhone] NVARCHAR(50) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'amountToCollect') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [amountToCollect] DECIMAL(10,2) NULL;
GO

IF COL_LENGTH('dbo.Orders', 'notes') IS NULL
  ALTER TABLE [dbo].[Orders] ADD [notes] NVARCHAR(500) NULL;
GO

IF OBJECT_ID('dbo.TripStops', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[TripStops](
    [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [tripId] INT NOT NULL,
    [orderId] INT NULL,
    [sequence] INT NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [stopType] NVARCHAR(20) NOT NULL,
    [city] NVARCHAR(150) NOT NULL,
    [address] NVARCHAR(300) NULL,
    [contactName] NVARCHAR(150) NULL,
    [contactPhone] NVARCHAR(50) NULL,
    [scheduledTime] NVARCHAR(20) NULL,
    [notes] NVARCHAR(500) NULL,
    [cashOnDelivery] BIT NOT NULL CONSTRAINT [DF_TripStops_cashOnDelivery] DEFAULT ((0)),
    [cashAmount] DECIMAL(10,2) NULL,
    [completed] BIT NOT NULL CONSTRAINT [DF_TripStops_completed] DEFAULT ((0)),
    [createdAt] DATETIME2(7) NOT NULL CONSTRAINT [DF_TripStops_createdAt] DEFAULT (sysutcdatetime())
  );

  ALTER TABLE [dbo].[TripStops]
    ADD CONSTRAINT [FK_TripStops_Trips]
    FOREIGN KEY ([tripId]) REFERENCES [dbo].[Trips]([id]) ON DELETE CASCADE;

  ALTER TABLE [dbo].[TripStops]
    ADD CONSTRAINT [FK_TripStops_Orders]
    FOREIGN KEY ([orderId]) REFERENCES [dbo].[Orders]([id]);

  ALTER TABLE [dbo].[TripStops]
    ADD CONSTRAINT [CHK_TripStops_stopType]
    CHECK ([stopType] IN ('pickup', 'delivery', 'checkpoint', 'other'));

  CREATE UNIQUE INDEX [UX_TripStops_trip_sequence] ON [dbo].[TripStops]([tripId], [sequence]);
  CREATE INDEX [IX_TripStops_tripId] ON [dbo].[TripStops]([tripId]);
  CREATE INDEX [IX_TripStops_orderId] ON [dbo].[TripStops]([orderId]);
END
GO
