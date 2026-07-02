export type NormalizedInvoice = {
  provider: string;
  vendorName?: string | null;
  vendorAddress?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  lineItems: NormalizedInvoiceItem[];
  rawResponse?: any;
  // Railway fields
  origin_station?: string | null;
  destination_station?: string | null;
  distance_km?: number | null;
  passenger_count?: number | null;
  train_number?: string | null;
  train_name?: string | null;
  // Flight fields
  origin_airport?: string | null;
  destination_airport?: string | null;
  airline?: string | null;
  flight_number?: string | null;
  travel_class?: string | null;
};

export type NormalizedInvoiceItem = {
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount?: number | null;
  currency?: string | null;
};
