/* =====================================================================
   PiwiDB - Esquema base (snapshot)
   Generado a partir de la base real el 2026-10-12.

   Es la FUENTE DE VERDAD del esquema: si el código o la documentación
   contradicen este archivo, manda este archivo.

   Ya incluye lo que aplican 001_route_sheet_foundation.sql y
   002_add_driver_truckplate.sql. NO es idempotente: sirve como
   referencia y para crear una base vacía desde cero. No ejecutar
   sobre una base existente.

   Uso en una base nueva:
     CREATE DATABASE PiwiDB;  -- luego:
     USE PiwiDB; y ejecutar este script.
   ===================================================================== */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
GO

/* ----------------------------- Tablas ------------------------------ */

CREATE TABLE dbo.Clients (
    id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name       NVARCHAR(200) NOT NULL,
    address    NVARCHAR(300) NOT NULL,
    phone      NVARCHAR(50)  NOT NULL,
    email      NVARCHAR(150) NOT NULL UNIQUE,
    createdAT  DATETIME2(7)  NOT NULL DEFAULT (GETDATE())   -- ojo: "createdAT" y hora local
);
GO

CREATE TABLE dbo.Drivers (
    id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name          NVARCHAR(150) NOT NULL,
    phone         NVARCHAR(50)  NULL,
    licenseNumber NVARCHAR(100) NOT NULL,
    notes         NVARCHAR(500) NULL,
    isActive      BIT           NOT NULL CONSTRAINT DF_Drivers_isActive  DEFAULT (1),
    createdAt     DATETIME2(7)  NOT NULL CONSTRAINT DF_Drivers_createdAt DEFAULT (SYSUTCDATETIME()),
    truckPlate    NVARCHAR(30)  NULL
);
GO

CREATE TABLE dbo.Vehicles (                       -- sin uso en el código actual
    id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    plate       NVARCHAR(30)  NOT NULL,
    description NVARCHAR(150) NULL,
    capacityKg  DECIMAL(10,2) NULL,
    capacityM3  DECIMAL(10,2) NULL,
    isActive    BIT           NOT NULL CONSTRAINT DF_Vehicles_isActive  DEFAULT (1),
    createdAt   DATETIME2(7)  NOT NULL CONSTRAINT DF_Vehicles_createdAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE TABLE dbo.Users (                          -- sin uso en el código actual (login hardcodeado)
    id           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    username     NVARCHAR(50)  NOT NULL UNIQUE,
    passwordHash NVARCHAR(200) NOT NULL,
    isActive     BIT           NOT NULL CONSTRAINT DF_Users_isActive  DEFAULT (1),
    createdAt    DATETIME2(7)  NOT NULL CONSTRAINT DF_Users_createdAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE TABLE dbo.Orders (
    id                 INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    clientId           INT           NOT NULL,
    origin             NVARCHAR(200) NOT NULL,
    destination        NVARCHAR(200) NOT NULL,
    weight             DECIMAL(8,2)  NOT NULL,
    volume             DECIMAL(8,2)  NULL,
    status             NVARCHAR(20)  NOT NULL,
    createdAt          DATETIME2(7)  NOT NULL DEFAULT (SYSUTCDATETIME()),
    originAddress      NVARCHAR(300) NULL,
    destinationAddress NVARCHAR(300) NULL,
    senderName         NVARCHAR(150) NULL,
    senderPhone        NVARCHAR(50)  NULL,
    recipientName      NVARCHAR(150) NULL,
    recipientPhone     NVARCHAR(50)  NULL,
    amountToCollect    DECIMAL(10,2) NULL,
    notes              NVARCHAR(500) NULL,
    originCity         NVARCHAR(100) NULL,
    destinationCity    NVARCHAR(100) NULL,
    CONSTRAINT chk_order_status CHECK (status IN
        (N'pendiente', N'asignada', N'en tránsito', N'entregado', N'cancelado'))
);
GO

CREATE TABLE dbo.TripBatches (                    -- "Salidas"
    id                   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tripDate             DATE          NOT NULL,
    routeName            NVARCHAR(100) NOT NULL DEFAULT (N'Ceres - Santa Fe'),
    originCity           NVARCHAR(100) NOT NULL,
    finalDestinationCity NVARCHAR(100) NOT NULL,
    direction            NVARCHAR(20)  NOT NULL,
    status               NVARCHAR(30)  NOT NULL DEFAULT (N'draft'),
    driverId             INT           NOT NULL,
    notes                NVARCHAR(500) NULL,
    createdAt            DATETIME2(7)  NOT NULL DEFAULT (SYSUTCDATETIME()),
    updatedAt            DATETIME2(7)  NULL,
    CONSTRAINT CK_TripBatches_Direction CHECK (direction IN (N'ida', N'vuelta')),
    CONSTRAINT CK_TripBatches_Status    CHECK (status IN
        (N'draft', N'confirmed', N'in_transit', N'completed', N'canceled'))
);
GO

CREATE TABLE dbo.Trips (                          -- "Hojas de ruta"
    id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tripDate      DATE          NOT NULL,
    vehicle       NVARCHAR(100) NULL,             -- legacy, siempre NULL
    driver        NVARCHAR(100) NULL,             -- legacy, siempre NULL
    status        NVARCHAR(20)  NOT NULL,
    createdAt     DATETIME2(7)  NOT NULL DEFAULT (GETDATE()),   -- hora local
    driverId      INT           NULL,
    vehicleId     INT           NULL,             -- sin uso en el código actual
    departureTime DATETIME2(7)  NULL,
    notes         NVARCHAR(500) NULL,
    origin        NVARCHAR(200) NULL,
    destination   NVARCHAR(200) NULL,
    batchId       INT           NULL,
    routeOrder    INT           NULL,
    sheetCity     NVARCHAR(100) NULL,
    CONSTRAINT chk_trip_status CHECK (status IN
        (N'scheduled', N'in_transit', N'delivered', N'canceled'))
);
GO

CREATE TABLE dbo.Order_Trip (
    orderId INT NOT NULL,
    tripId  INT NOT NULL,
    PRIMARY KEY (orderId, tripId)                 -- no impide que una orden esté en dos viajes
);
GO

CREATE TABLE dbo.TripStops (
    id             INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tripId         INT           NOT NULL,
    orderId        INT           NULL,
    sequence       INT           NOT NULL,
    stopType       NVARCHAR(20)  NOT NULL,
    city           NVARCHAR(150) NOT NULL,
    address        NVARCHAR(300) NULL,
    contactName    NVARCHAR(150) NULL,
    contactPhone   NVARCHAR(50)  NULL,
    scheduledTime  NVARCHAR(20)  NULL,
    notes          NVARCHAR(500) NULL,
    cashOnDelivery BIT           NOT NULL CONSTRAINT DF_TripStops_cashOnDelivery DEFAULT (0),
    cashAmount     DECIMAL(10,2) NULL,
    completed      BIT           NOT NULL CONSTRAINT DF_TripStops_completed      DEFAULT (0),
    createdAt      DATETIME2(7)  NOT NULL CONSTRAINT DF_TripStops_createdAt      DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CHK_TripStops_stopType CHECK (stopType IN
        (N'pickup', N'delivery', N'checkpoint', N'other'))
);
GO

CREATE TABLE dbo.Routes (
    id           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tripId       INT           NOT NULL UNIQUE,   -- una ruta por viaje
    routeGeoJson NVARCHAR(MAX) NOT NULL,
    pdfUrl       NVARCHAR(500) NULL,
    generatedAt  DATETIME2(7)  NOT NULL DEFAULT (GETDATE())     -- hora local
);
GO

CREATE TABLE dbo.RouteCities (
    id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    routeName NVARCHAR(100) NOT NULL,
    cityName  NVARCHAR(100) NOT NULL,
    sequence  INT           NOT NULL,
    isActive  BIT           NOT NULL DEFAULT (1),
    createdAt DATETIME2(7)  NOT NULL DEFAULT (SYSUTCDATETIME()),
    -- ojo: los UNIQUE incluyen filas inactivas (isActive = 0)
    CONSTRAINT UQ_RouteCities_Route_City     UNIQUE (routeName, cityName),
    CONSTRAINT UQ_RouteCities_Route_Sequence UNIQUE (routeName, sequence)
);
GO

/* --------------------------- Foreign keys -------------------------- */

ALTER TABLE dbo.Orders     ADD CONSTRAINT fk_orders_clients     FOREIGN KEY (clientId)  REFERENCES dbo.Clients(id)     ON UPDATE CASCADE;   -- sin ON DELETE
ALTER TABLE dbo.Order_Trip ADD CONSTRAINT fk_ot_order           FOREIGN KEY (orderId)   REFERENCES dbo.Orders(id)      ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dbo.Order_Trip ADD CONSTRAINT fk_ot_trip            FOREIGN KEY (tripId)    REFERENCES dbo.Trips(id)       ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dbo.Routes     ADD CONSTRAINT fk_routes_trips       FOREIGN KEY (tripId)    REFERENCES dbo.Trips(id)       ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dbo.TripBatches ADD CONSTRAINT FK_TripBatches_Drivers FOREIGN KEY (driverId) REFERENCES dbo.Drivers(id);
ALTER TABLE dbo.Trips      ADD CONSTRAINT FK_Trips_Drivers      FOREIGN KEY (driverId)  REFERENCES dbo.Drivers(id);
ALTER TABLE dbo.Trips      ADD CONSTRAINT FK_Trips_TripBatches  FOREIGN KEY (batchId)   REFERENCES dbo.TripBatches(id);
ALTER TABLE dbo.Trips      ADD CONSTRAINT FK_Trips_Vehicles     FOREIGN KEY (vehicleId) REFERENCES dbo.Vehicles(id);
ALTER TABLE dbo.TripStops  ADD CONSTRAINT FK_TripStops_Orders   FOREIGN KEY (orderId)   REFERENCES dbo.Orders(id);      -- sin cascade
ALTER TABLE dbo.TripStops  ADD CONSTRAINT FK_TripStops_Trips    FOREIGN KEY (tripId)    REFERENCES dbo.Trips(id)       ON DELETE CASCADE;
GO

/* ----------------------------- Índices ----------------------------- */

CREATE UNIQUE INDEX UX_Drivers_licenseNumber  ON dbo.Drivers (licenseNumber);
CREATE UNIQUE INDEX UX_Vehicles_plate         ON dbo.Vehicles (plate);

CREATE INDEX idx_orders_status                 ON dbo.Orders (status);
CREATE INDEX IX_Orders_Status_DestinationCity  ON dbo.Orders (status, destinationCity);
CREATE INDEX IX_Orders_Status_OriginCity       ON dbo.Orders (status, originCity);

CREATE INDEX IX_RouteCities_RouteName_Sequence ON dbo.RouteCities (routeName, sequence);  -- redundante con el UNIQUE

CREATE INDEX idx_trips_date                    ON dbo.Trips (tripDate);
CREATE INDEX IX_Trips_BatchId                  ON dbo.Trips (batchId);
CREATE INDEX IX_Trips_BatchId_RouteOrder       ON dbo.Trips (batchId, routeOrder);
-- Una hoja de ruta por ciudad por salida. Requiere QUOTED_IDENTIFIER ON en la sesión para DML.
CREATE UNIQUE INDEX UQ_Trips_Batch_SheetCity   ON dbo.Trips (batchId, sheetCity)
    WHERE batchId IS NOT NULL AND sheetCity IS NOT NULL;

CREATE INDEX IX_TripStops_orderId              ON dbo.TripStops (orderId);
CREATE INDEX IX_TripStops_tripId               ON dbo.TripStops (tripId);
CREATE UNIQUE INDEX UX_TripStops_trip_sequence ON dbo.TripStops (tripId, sequence);
GO
