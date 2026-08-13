export interface ConfirmedTripBatchTripSummary {
  id: number;
  batchId: number;
  sheetCity: string;
  routeOrder: number;
  stopsCreated: number;
}

export interface ConfirmTripBatchResult {
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
  trips: ConfirmedTripBatchTripSummary[];
}
