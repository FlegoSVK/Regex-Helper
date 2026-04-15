export interface ParsedLine {
  id: number;
  originalContent: string;
  isTranslatable: boolean;
  prefix: string; // The part before the first text
  text: string;   // The first text to translate (for backward compatibility)
  suffix: string; // The part after the last text
  csvRow?: string[]; // The parsed CSV row if applicable
  parts?: { isTranslatable: boolean, text: string }[]; // All parts including technical and translatable
}

export interface CsvConfig {
  delimiter: string;
  quoteChar: string;
  targetColumn: number;
}

export interface ProjectMap {
  fileName: string;
  lines: ParsedLine[];
  timestamp: number;
  gameName?: string;
  regexPattern?: string;
  encoding?: string;
  csvConfig?: CsvConfig;
}
