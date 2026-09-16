import type { VendorMeta } from "@/lib/types";

export const VENDORS: VendorMeta[] = [
  {
    id: "V1",
    name: "Shree Ganesh Packaging Pvt Ltd",
    fileName: "V1-shree-ganesh-quote.xlsx",
    fileType: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    receivedAt: "2026-09-17T11:20:00+05:30",
  },
  {
    id: "V2",
    name: "Apex Corrugators LLP",
    fileName: "V2-apex-corrugators-quote.pdf",
    fileType: "pdf",
    mimeType: "application/pdf",
    receivedAt: "2026-09-18T09:05:00+05:30",
  },
  {
    id: "V3",
    name: "National Board & Carton Co.",
    fileName: "V3-national-board-quote.docx",
    fileType: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    receivedAt: "2026-09-19T16:40:00+05:30",
  },
  {
    id: "V4",
    name: "Vishal Packaging Works",
    fileName: "V4-vishal-packaging-ratecard.jpg",
    fileType: "image",
    mimeType: "image/jpeg",
    receivedAt: "2026-09-20T14:12:00+05:30",
  },
  {
    id: "V5",
    name: "Balaji Corrugated Industries",
    fileName: "V5-balaji-corrugated-email.txt",
    fileType: "text",
    mimeType: "text/plain",
    receivedAt: "2026-09-22T10:30:00+05:30",
  },
];

export function getVendor(id: string): VendorMeta | undefined {
  return VENDORS.find((v) => v.id === id);
}
