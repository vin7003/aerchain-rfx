import * as XLSX from "xlsx";
import mammoth from "mammoth";
// pdf-parse-fork ships as CommonJS; import the default export dynamically to
// avoid it trying to read its own test fixture on import in some bundlers.
import pdfParse from "pdf-parse-fork";

export type ParsedDocument =
  | { kind: "text"; text: string }
  | { kind: "image"; base64: string; mediaType: string };

export async function parseVendorFile(
  buffer: Buffer,
  fileType: "xlsx" | "pdf" | "docx" | "image" | "text",
  mimeType: string
): Promise<ParsedDocument> {
  switch (fileType) {
    case "xlsx": {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      return { kind: "text", text: parts.join("\n\n") };
    }
    case "docx": {
      const result = await mammoth.convertToHtml({ buffer });
      return { kind: "text", text: result.value };
    }
    case "pdf": {
      const data = await pdfParse(buffer);
      return { kind: "text", text: data.text };
    }
    case "image": {
      return { kind: "image", base64: buffer.toString("base64"), mediaType: mimeType };
    }
    case "text": {
      return { kind: "text", text: buffer.toString("utf-8") };
    }
    default: {
      const _exhaustive: never = fileType;
      throw new Error(`Unsupported file type: ${_exhaustive}`);
    }
  }
}
