// Core domain types shared between API routes and the frontend.

export type RfxLineItem = {
  code: string;
  description: string;
  dimensionsMm: string;
  ply: number;
  boardGsm: number;
  print: string;
  qty: number;
  uom: string;
};

export type RfxQuestion = { id: string; question: string };

export type Rfx = {
  id: string;
  title: string;
  buyerCompany: string;
  buyerContact: string;
  category: string;
  createdAt: string;
  background: string;
  currency: string;
  deliveryTerms: string;
  paymentTermsRequested: string;
  quoteValidityRequiredDays: number;
  lineItems: RfxLineItem[];
  questionnaire: RfxQuestion[];
  termsRequested: Record<string, string>;
};

export type VendorMeta = {
  id: string;
  name: string;
  fileName: string;
  fileType: "xlsx" | "pdf" | "docx" | "image" | "text";
  mimeType: string;
  receivedAt: string;
};

// One extracted line item as the model reports it — always tied back to the
// RFx line item it believes it matches (or null if it can't confidently map
// it to anything on our RFx).
export type ExtractedLine = {
  rfxCode: string | null; // null => could not map to a known RFx line
  vendorLabel: string; // however the vendor described this line, verbatim-ish
  unitPrice: number | null;
  currency: string; // as stated by vendor, e.g. "INR", "USD"
  priceBasis: "per_box" | "per_100_pieces" | "per_kg" | "unknown";
  normalizedUnitPriceInr: number | null; // after currency + basis conversion
  confidence: "high" | "medium" | "low";
  notes: string; // short rationale / what's uncertain
  sourceQuote: string; // the exact snippet/cell this came from, for traceability
};

export type ExtractionResult = {
  vendorId: string;
  extractedAt: string;
  lines: ExtractedLine[];
  unresolvedNotes: string[]; // things the model explicitly could not price/resolve
  questionnaireAnswers: { questionId: string; answer: string; sourceQuote: string }[];
  commercialTerms: {
    payment: string | null;
    delivery: string | null;
    validity: string | null;
    otherNotes: string[];
  };
  globalFlags: string[]; // e.g. "discount in footnote not applied to unit prices"
  rawModelNotes: string; // free-text summary of how the model approached this doc
};

export type ComparisonCell = {
  vendorId: string;
  unitPriceInr: number | null;
  confidence: "high" | "medium" | "low" | "missing";
  notes: string;
  sourceQuote: string;
};

export type ComparisonRow = {
  rfxCode: string;
  description: string;
  qty: number;
  cells: ComparisonCell[];
};

export type AnalystChatMessage = {
  role: "user" | "assistant";
  content: string;
  table?: { headers: string[]; rows: (string | number)[][] };
};
