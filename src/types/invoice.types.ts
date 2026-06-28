export type NormalizedInvoice = {
  provider: string;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  lineItems: NormalizedInvoiceItem[];
  rawResponse?: any;
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
