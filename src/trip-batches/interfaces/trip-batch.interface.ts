export interface TripBatch {
  id: number;
  tripDate: string;
  routeName: string;
  originCity: string;
  finalDestinationCity: string;
  direction: string;
  status: string;
  driverId: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripBatchWithDriver extends TripBatch {
  driverName: string | null;
  truckPlate: string | null;
}

export interface TripBatchTrip {
  id: number;
  tripDate: string;
  batchId: number;
  routeOrder: number | null;
  sheetCity: string | null;
  origin: string;
  destination: string;
  status: string;
  notes: string | null;
  driverId: number | null;
  createdAt: string;
}

export interface ConfirmTripBatchResponseTrip {
  id: number;
  batchId: number;
  sheetCity: string;
  routeOrder: number;
  stopsCreated: number;
}

export interface ConfirmTripBatchResponse {
  id: number;
  tripDate: string;
  routeName: string;
  direction: string;
  originCity: string;
  finalDestinationCity: string;
  status: string;
  driverId: number;
  groupsCreated: number;
  ordersAssigned: number;
  trips: ConfirmTripBatchResponseTrip[];
}
