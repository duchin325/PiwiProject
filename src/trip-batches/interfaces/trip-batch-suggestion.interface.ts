export interface CandidateOrderRow {
  id: number;
  origin: string;
  destination: string;
  originCity: string | null;
  destinationCity: string | null;
  originAddress: string | null;
  destinationAddress: string | null;
  senderName: string | null;
  senderPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  amountToCollect: number | null;
  notes: string | null;
  createdAt: string;
}

export interface SuggestedStop {
  orderId: number;
  sequence: number;
  stopType: 'delivery' | 'pickup';
  city: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  cashOnDelivery: boolean;
  cashAmount: number;
  notes: string | null;
}

export interface SuggestedGroup {
  city: string;
  routeOrder: number;
  totalOrders: number;
  totalCashAmount: number;
  stops: SuggestedStop[];
}

// Motivos estables por los que una encomienda candidata no entra en ningun grupo:
// - city_not_resolved: origin/destination (y sus *City) estan vacios o no son utilizables.
// - city_not_in_route: la ciudad no coincide con ninguna RouteCity activa de la ruta.
// - ambiguous_city: la ciudad coincide por palabras con mas de una RouteCity.
// - is_origin_city: la ciudad coincide con la ciudad de origen del viaje.
export type SkippedOrderReason =
  | 'city_not_resolved'
  | 'city_not_in_route'
  | 'ambiguous_city'
  | 'is_origin_city';

export interface SkippedOrder {
  orderId: number;
  reason: SkippedOrderReason;
}

export interface TripBatchSuggestion {
  tripDate: string;
  routeName: string;
  direction: string;
  originCity: string;
  finalDestinationCity: string;
  driverId: number;
  groups: SuggestedGroup[];
  skippedOrders?: SkippedOrder[];
}
