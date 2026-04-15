import Papa from 'papaparse';
import { ParsedLine, ProjectMap, CsvConfig } from '../types';

// Logic for dynamic localization file parsing
// Pattern is provided by the user or the analyzer

export const parseFileContent = (content: string, fileName: string, regexPattern: string): ProjectMap => {
  if (regexPattern.startsWith('CSV_CONFIG:')) {
    try {
      const configStr = regexPattern.substring('CSV_CONFIG:'.length).trim();
      const csvConfig: CsvConfig = JSON.parse(configStr);
      
      let delimiter = csvConfig.delimiter;
      if (delimiter === '\\t') delimiter = '\t';

      const parsed = Papa.parse<string[]>(content, {
        delimiter: delimiter,
        quoteChar: csvConfig.quoteChar,
        header: false,
        skipEmptyLines: false,
      });

      const parsedLines: ParsedLine[] = parsed.data.map((row, index) => {
        if (row.length === 1 && row[0] === "") {
           return {
             id: index,
             originalContent: '',
             isTranslatable: false,
             prefix: '',
             text: '',
             suffix: '',
             csvRow: row,
           };
        }

        if (row.length > csvConfig.targetColumn) {
          const text = row[csvConfig.targetColumn];
          return {
            id: index,
            originalContent: Papa.unparse([row], { delimiter: delimiter, quoteChar: csvConfig.quoteChar }),
            isTranslatable: !!text && text.trim().length > 0,
            prefix: '',
            text: text || '',
            suffix: '',
            csvRow: row,
          };
        }
        
        return {
          id: index,
          originalContent: Papa.unparse([row], { delimiter: delimiter, quoteChar: csvConfig.quoteChar }),
          isTranslatable: false,
          prefix: '',
          text: '',
          suffix: '',
          csvRow: row,
        };
      });

      return {
        fileName,
        lines: parsedLines,
        timestamp: Date.now(),
        regexPattern,
        csvConfig,
      };
    } catch (e) {
      console.error("Failed to parse CSV config or content:", e);
      // Fallback to normal regex parsing if it fails
    }
  }

  // Split by any newline format
  const rawLines = content.split(/\r?\n/);
  
  let regex: RegExp;
  try {
    regex = new RegExp(regexPattern);
  } catch (e) {
    console.error("Invalid regex pattern:", regexPattern);
    regex = /^(.*)$/; // Fallback
  }
  
  const parsedLines: ParsedLine[] = rawLines.map((line, index) => {
    
    // Check if line matches the dynamic format
    const match = line.match(regex);

    if (match && match.length >= 3 && match.length % 2 === 0) { // match.length includes the full match at index 0, so 4, 6, 8...
      const parts: { isTranslatable: boolean, text: string }[] = [];
      for (let i = 2; i < match.length - 1; i++) {
        parts.push({
          isTranslatable: i % 2 === 0,
          text: match[i] || ''
        });
      }

      return {
        id: index,
        originalContent: line,
        isTranslatable: true,
        prefix: match[1] || '',
        text: match[2] || '',
        suffix: match[match.length - 1] || '',
        parts: parts
      };
    }

    // Default: Non-translatable (headers, empty lines, or different types)
    return {
      id: index,
      originalContent: line,
      isTranslatable: false,
      prefix: line,
      text: '',
      suffix: '',
    };
  });

  return {
    fileName,
    lines: parsedLines,
    timestamp: Date.now(),
    regexPattern,
  };
};

export const generateExportText = (projectMap: ProjectMap): string => {
  // Filter out non-translatable lines completely to avoid empty lines in the text file
  // Join with CRLF for Windows compatibility
  // Escape newlines so multiline CSV fields don't break the line-by-line translation format
  return projectMap.lines
    .filter(line => line.isTranslatable)
    .flatMap(line => {
      if (line.parts && line.parts.length > 0) {
        return line.parts.filter(p => p.isTranslatable).map(p => p.text.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
      }
      return [line.text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')];
    })
    .join('\r\n');
};

export const generateMergedFile = (projectMap: ProjectMap, translatedText: string): string => {
  const translatedLines = translatedText.split(/\r?\n/);
  let translationIndex = 0;

  if (projectMap.csvConfig) {
    const { delimiter, quoteChar, targetColumn } = projectMap.csvConfig;
    let actualDelimiter = delimiter;
    if (actualDelimiter === '\\t') actualDelimiter = '\t';

    const newData = projectMap.lines.map(line => {
      if (!line.isTranslatable || !line.csvRow) {
        return line.csvRow || [];
      }
      
      let translatedLineContent = line.text;
      if (translationIndex < translatedLines.length) {
        // Unescape newlines
        translatedLineContent = translatedLines[translationIndex].replace(/\\r/g, '\r').replace(/\\n/g, '\n');
        translationIndex++;
      }
      
      const newRow = [...line.csvRow];
      newRow[targetColumn] = translatedLineContent;
      return newRow;
    });
    
    return Papa.unparse(newData, {
      delimiter: actualDelimiter,
      quoteChar: quoteChar,
      newline: '\r\n'
    });
  }

  // Debug log to check counts
  const expectedCount = projectMap.lines.reduce((acc, line) => {
    if (!line.isTranslatable) return acc;
    if (line.parts && line.parts.length > 0) {
      return acc + line.parts.filter(p => p.isTranslatable).length;
    }
    return acc + 1;
  }, 0);
  console.log(`Merging: Expected ${expectedCount} lines, got ${translatedLines.length} in translation file.`);

  // Map lines and join with CRLF (\r\n) as requested
  return projectMap.lines.map((line) => {
    if (!line.isTranslatable) {
      return line.originalContent;
    }

    if (line.parts && line.parts.length > 0) {
      let mergedLine = line.prefix;
      for (const part of line.parts) {
        if (part.isTranslatable) {
          if (translationIndex < translatedLines.length) {
            mergedLine += translatedLines[translationIndex];
            translationIndex++;
          } else {
            mergedLine += part.text;
          }
        } else {
          mergedLine += part.text;
        }
      }
      mergedLine += line.suffix;
      return mergedLine;
    }

    // Get the next available translated line from the list
    let translatedLineContent = line.text; // Fallback to original
    
    if (translationIndex < translatedLines.length) {
      // Do NOT unescape \n to actual newlines for Regex formats!
      // Regex matched lines never contained actual newlines, so any \n is a literal \n.
      translatedLineContent = translatedLines[translationIndex];
      translationIndex++;
    }
    
    // Reconstruct the line: Prefix + TranslatedText + Suffix
    return `${line.prefix}${translatedLineContent}${line.suffix}`;
  }).join('\r\n');
};