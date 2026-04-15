import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { StepCard } from './components/StepCard';
import { parseFileContent, generateExportText, generateMergedFile } from './services/parser';
import { analyzeFileContent, analyzeManualSelection } from './services/analyzer';
import { ProjectMap } from './types';
import { Upload, Download, RefreshCw, FileText, Check, Code, Search, Pickaxe, Swords, Save, Trash2, Maximize, Minimize } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface GameProfile {
  id: string;
  name: string;
  icon: any;
  regex: string;
  encoding?: string;
  isCustom?: boolean;
}

interface TextMark {
  text: string;
  start: number;
  end: number;
}

// Pre-defined profiles
const DEFAULT_GAME_PROFILES: GameProfile[] = [
  { id: 'custom', name: 'Vlastný / Analyzátor', icon: Search, regex: '', encoding: 'utf-8' }
];

const App: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [projectMap, setProjectMap] = useState<ProjectMap | null>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [showOnlyTranslated, setShowOnlyTranslated] = useState<boolean>(true);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    expectedCount: number;
    actualCount: number;
    warnings: string[];
    content: string;
  } | null>(null);
  
  // New Project State
  const [gameProfiles, setGameProfiles] = useState<GameProfile[]>(DEFAULT_GAME_PROFILES);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<string>('custom');
  const [gameName, setGameName] = useState<string>('');
  const [regexPattern, setRegexPattern] = useState<string>('');
  const [encoding, setEncoding] = useState<string>('utf-8');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  // CSV Mode State
  const [isCsvMode, setIsCsvMode] = useState<boolean>(false);
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [csvQuoteChar, setCsvQuoteChar] = useState<string>('"');
  const [csvTargetColumn, setCsvTargetColumn] = useState<number>(1);

  // File Selection State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedFileType, setDetectedFileType] = useState<string>('');

  // Manual Analysis State
  const [isManualMode, setIsManualMode] = useState(false);
  const [isManualFullscreen, setIsManualFullscreen] = useState(false);
  const [manualLines, setManualLines] = useState<string[]>([]);
  const [manualViewStart, setManualViewStart] = useState(0);
  const [manualViewCount, setManualViewCount] = useState(100);
  const [manualMarks, setManualMarks] = useState<Record<number, { translatable?: TextMark[], technical?: TextMark[] }>>({});
  const [goToLineInput, setGoToLineInput] = useState("");
  
  // Delete Profile Modal State
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

  useEffect(() => {
    const savedProfiles = localStorage.getItem('customGameProfiles');
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles);
        const customProfiles = parsed.map((p: any) => ({ ...p, icon: Search, isCustom: true }));
        setGameProfiles([...customProfiles, DEFAULT_GAME_PROFILES[0]]);
      } catch (e) {
        console.error("Failed to parse saved profiles", e);
      }
    }
  }, []);

  // Refs for file inputs
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const batchMergeFileInputRef = useRef<HTMLInputElement>(null);
  const analyzerFileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const translationInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfile(profileId);
    const profile = gameProfiles.find(p => p.id === profileId);
    if (profile) {
      setGameName(profile.name === 'Vlastný / Analyzátor' ? '' : profile.name);
      setEncoding(profile.encoding || 'utf-8');
      
      if (profile.regex.startsWith('CSV_CONFIG:')) {
        setIsCsvMode(true);
        try {
          const config = JSON.parse(profile.regex.substring('CSV_CONFIG:'.length));
          setCsvDelimiter(config.delimiter || ',');
          setCsvQuoteChar(config.quoteChar || '"');
          setCsvTargetColumn(config.targetColumn !== undefined ? config.targetColumn : 1);
        } catch (e) {
          console.error("Failed to parse CSV config", e);
        }
      } else {
        setIsCsvMode(false);
        setRegexPattern(profile.regex);
      }
    }
  };

  const saveCustomProfile = (silent = false) => {
    const finalRegex = isCsvMode 
      ? `CSV_CONFIG:${JSON.stringify({ delimiter: csvDelimiter, quoteChar: csvQuoteChar, targetColumn: csvTargetColumn })}`
      : regexPattern;

    if (!gameName || !finalRegex) {
      if (!silent) alert("Zadajte názov hry a konfiguráciu pre uloženie profilu.");
      return;
    }
    
    const newProfileId = `custom_${Date.now()}`;
    const newProfile = { id: newProfileId, name: gameName, regex: finalRegex, encoding };
    
    const savedProfilesStr = localStorage.getItem('customGameProfiles');
    let savedProfiles: any[] = [];
    if (savedProfilesStr) {
      try {
        savedProfiles = JSON.parse(savedProfilesStr);
      } catch (e) {}
    }
    
    const existingIndex = savedProfiles.findIndex((p: any) => p.name === gameName);
    if (existingIndex >= 0) {
      savedProfiles[existingIndex].regex = finalRegex;
      savedProfiles[existingIndex].encoding = encoding;
    } else {
      savedProfiles.push(newProfile);
    }
    
    localStorage.setItem('customGameProfiles', JSON.stringify(savedProfiles));
    
    const customProfiles = savedProfiles.map((p: any) => ({ ...p, icon: Search, isCustom: true }));
    setGameProfiles([...customProfiles, DEFAULT_GAME_PROFILES[0]]);
    setSelectedProfile(existingIndex >= 0 ? savedProfiles[existingIndex].id : newProfileId);
    if (!silent) alert("Profil bol uložený.");
  };

  const requestDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileToDelete(id);
  };

  const confirmDeleteProfile = () => {
    if (!profileToDelete) return;
    const id = profileToDelete;
    const savedProfilesStr = localStorage.getItem('customGameProfiles');
    if (savedProfilesStr) {
      try {
        let savedProfiles = JSON.parse(savedProfilesStr);
        savedProfiles = savedProfiles.filter((p: any) => p.id !== id);
        localStorage.setItem('customGameProfiles', JSON.stringify(savedProfiles));
        
        const customProfiles = savedProfiles.map((p: any) => ({ ...p, icon: Search, isCustom: true }));
        setGameProfiles([...customProfiles, DEFAULT_GAME_PROFILES[0]]);
        
        if (selectedProfile === id) {
          setSelectedProfile('custom');
          setGameName('');
          setRegexPattern('');
          setIsCsvMode(false);
          setEncoding('utf-8');
        }
      } catch (err) {}
    }
    setProfileToDelete(null);
  };

  const cancelDeleteProfile = () => {
    setProfileToDelete(null);
  };

  const handleManualViewChange = (delta: number) => {
    setManualViewStart(prev => Math.max(0, Math.min(prev + delta, manualLines.length - manualViewCount)));
  };

  const handleGoToLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lineNum = parseInt(goToLineInput, 10);
    if (!isNaN(lineNum)) {
      const targetIndex = lineNum - 1;
      const maxStart = Math.max(0, manualLines.length - manualViewCount);
      setManualViewStart(Math.max(0, Math.min(targetIndex, maxStart)));
    }
    setGoToLineInput("");
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setManualLines(content.split(/\r?\n/));
      setIsManualMode(true);
      setManualViewStart(0);
      setManualMarks({});
    };
    reader.readAsText(file, encoding);
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  };

  const handleMarkSelection = (type: 'translatable' | 'technical' | 'clear') => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    
    const getLineElement = (node: Node | null): HTMLElement | null => {
      let current = node;
      while (current && current !== document.body) {
        if (current instanceof HTMLElement && current.dataset.contentIndex) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    };

    const startLineEl = getLineElement(range.startContainer);
    const endLineEl = getLineElement(range.endContainer);

    if (!startLineEl || !endLineEl) return;

    const startLineIdx = parseInt(startLineEl.dataset.contentIndex!, 10);
    const endLineIdx = parseInt(endLineEl.dataset.contentIndex!, 10);

    const minLineIdx = Math.min(startLineIdx, endLineIdx);
    const maxLineIdx = Math.max(startLineIdx, endLineIdx);

    const getAbsoluteOffset = (container: Node, offset: number, lineDiv: HTMLElement) => {
      let absoluteOffset = 0;
      const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode === container) {
          absoluteOffset += offset;
          break;
        }
        absoluteOffset += currentNode.nodeValue?.length || 0;
        currentNode = walker.nextNode();
      }
      return absoluteOffset;
    };

    setManualMarks(prev => {
      const next = { ...prev };
      
      for (let i = minLineIdx; i <= maxLineIdx; i++) {
        let startOffset = 0;
        let endOffset = manualLines[i].length;

        if (i === minLineIdx) {
          startOffset = getAbsoluteOffset(range.startContainer, range.startOffset, startLineEl);
        }
        if (i === maxLineIdx) {
          endOffset = getAbsoluteOffset(range.endContainer, range.endOffset, endLineEl);
        }

        if (startOffset >= endOffset) continue;

        const text = manualLines[i].substring(startOffset, endOffset);
        if (text.length === 0) continue;

        const currentMark = next[i] || { technical: [] };
        const newMark = { text, start: startOffset, end: endOffset };

        if (type === 'translatable') {
           next[i] = { ...currentMark, translatable: [...(currentMark.translatable || []), newMark] };
        } else if (type === 'technical') {
           next[i] = { ...currentMark, technical: [...(currentMark.technical || []), newMark] };
        } else if (type === 'clear') {
           let newTranslatable = (currentMark.translatable || []).filter(t => 
              !(Math.max(startOffset, t.start) < Math.min(endOffset, t.end))
           );
           
           let newTechnical = (currentMark.technical || []).filter(t => 
              !(Math.max(startOffset, t.start) < Math.min(endOffset, t.end))
           );
           
           next[i] = { ...currentMark, translatable: newTranslatable, technical: newTechnical };
        }
      }
      return next;
    });
    
    selection.removeAllRanges();
  };

  const handleGenerateManualRegex = async () => {
    const examples = Object.entries(manualMarks).map(([idx, mark]) => {
      const line = manualLines[parseInt(idx)];
      const translatable = mark.translatable?.map(t => t.text).join(' | ') || '';
      let technical = mark.technical?.map(t => t.text) || [];

      // Ak je označený iba text na preklad, všetko ostatné je technická časť
      if (mark.translatable && mark.translatable.length > 0 && technical.length === 0) {
        const sortedTranslatable = [...mark.translatable].sort((a, b) => a.start - b.start);
        let currentPos = 0;
        sortedTranslatable.forEach(t => {
          if (t.start > currentPos) {
            technical.push(line.substring(currentPos, t.start));
          }
          currentPos = t.end;
        });
        if (currentPos < line.length) {
          technical.push(line.substring(currentPos));
        }
      }

      return {
        line,
        translatable,
        technical
      };
    }).filter(e => e.translatable || e.technical.length > 0);

    if (examples.length === 0) {
      alert("Najprv označte aspoň jeden text na preklad alebo technickú časť.");
      return;
    }

    setIsAnalyzing(true);
    const suggestedRegex = await analyzeManualSelection(examples, gameName || 'Neznáma hra');
    if (suggestedRegex) {
      if (suggestedRegex.startsWith('CSV_CONFIG:')) {
        setIsCsvMode(true);
        try {
          const config = JSON.parse(suggestedRegex.substring('CSV_CONFIG:'.length));
          setCsvDelimiter(config.delimiter || ',');
          setCsvQuoteChar(config.quoteChar || '"');
          setCsvTargetColumn(config.targetColumn !== undefined ? config.targetColumn : 1);
        } catch (e) {}
      } else {
        setIsCsvMode(false);
        setRegexPattern(suggestedRegex);
      }
      setIsManualMode(false);
    } else {
      alert("Nepodarilo sa navrhnúť regulárny výraz z manuálneho výberu.");
    }
    setIsAnalyzing(false);
  };

  const renderManualLine = (line: string, index: number) => {
    const mark = manualMarks[index];
    if (!mark) return <span className="text-gray-300">{line}</span>;

    const parts: { start: number, end: number, type: string, text: string }[] = [];

    mark.translatable?.forEach(trans => {
      parts.push({ start: trans.start, end: trans.end, type: 'translatable', text: trans.text });
    });

    mark.technical?.forEach(tech => {
      parts.push({ start: tech.start, end: tech.end, type: 'technical', text: tech.text });
    });

    parts.sort((a, b) => a.start - b.start);

    const validParts = [];
    let lastEnd = 0;
    for (const p of parts) {
      if (p.start >= lastEnd) {
        validParts.push(p);
        lastEnd = p.end;
      }
    }

    if (validParts.length === 0) return <span className="text-gray-300">{line}</span>;

    let elements: React.ReactNode[] = [];
    let currentIdx = 0;
    validParts.forEach((p, i) => {
      if (p.start > currentIdx) {
        elements.push(<span key={`text-${i}`} className="text-gray-300">{line.substring(currentIdx, p.start)}</span>);
      }
      const colorClass = p.type === 'translatable' ? 'bg-cyber-success/40 text-cyber-success px-1 rounded' : 'bg-orange-500/40 text-orange-400 px-1 rounded';
      elements.push(<span key={`mark-${i}`} className={colorClass}>{p.text}</span>);
      currentIdx = p.end;
    });

    if (currentIdx < line.length) {
      elements.push(<span key="end" className="text-gray-300">{line.substring(currentIdx)}</span>);
    }

    return <>{elements}</>;
  };

  const handleAnalyzerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const suggestedRegex = await analyzeFileContent(content, gameName || 'Neznáma hra');
      if (suggestedRegex) {
        if (suggestedRegex.startsWith('CSV_CONFIG:')) {
          setIsCsvMode(true);
          try {
            const config = JSON.parse(suggestedRegex.substring('CSV_CONFIG:'.length));
            setCsvDelimiter(config.delimiter || ',');
            setCsvQuoteChar(config.quoteChar || '"');
            setCsvTargetColumn(config.targetColumn !== undefined ? config.targetColumn : 1);
          } catch (e) {}
        } else {
          setIsCsvMode(false);
          setRegexPattern(suggestedRegex);
        }
      } else {
        alert("Nepodarilo sa navrhnúť regulárny výraz. Skúste ho zadať manuálne.");
      }
      setIsAnalyzing(false);
    };
    reader.readAsText(file, encoding);
    // Reset input
    if (analyzerFileInputRef.current) analyzerFileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    let type = 'Neznámy formát';
    if (ext === 'csv') {
      type = 'CSV (Comma Separated Values)';
      if (!isCsvMode && !regexPattern) {
        setIsCsvMode(true);
        setCsvDelimiter(',');
      }
    } else if (ext === 'tsv') {
      type = 'TSV (Tab Separated Values)';
      if (!isCsvMode && !regexPattern) {
        setIsCsvMode(true);
        setCsvDelimiter('\\t');
      }
    } else if (ext === 'json') {
      type = 'JSON';
    } else if (ext === 'txt') {
      type = 'Textový súbor (TXT)';
    } else if (ext === 'xml') {
      type = 'XML';
    }
    
    setDetectedFileType(type);
    if (sourceFileInputRef.current) sourceFileInputRef.current.value = '';
  };

  const processSelectedFile = () => {
    if (!selectedFile) return;

    const finalRegex = isCsvMode 
      ? `CSV_CONFIG:${JSON.stringify({ delimiter: csvDelimiter, quoteChar: csvQuoteChar, targetColumn: csvTargetColumn })}`
      : regexPattern;

    if (!isCsvMode && !regexPattern) {
      alert("Zadajte regulárny výraz pred spracovaním súboru.");
      return;
    }

    // Auto-save custom profile if it's new or modified
    if (gameName && selectedProfile === 'custom') {
      saveCustomProfile(true);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const map = parseFileContent(content, selectedFile.name, finalRegex);
      map.gameName = gameName;
      map.regexPattern = finalRegex;
      map.encoding = encoding;
      setProjectMap(map);
      setStep(2);
    };
    reader.readAsText(selectedFile, encoding);
  };

  const handleBatchProcess = () => {
    const finalRegex = isCsvMode 
      ? `CSV_CONFIG:${JSON.stringify({ delimiter: csvDelimiter, quoteChar: csvQuoteChar, targetColumn: csvTargetColumn })}`
      : regexPattern;

    if (!isCsvMode && !regexPattern) {
      alert("Zadajte regulárny výraz pred hromadným spracovaním.");
      return;
    }

    // Auto-save custom profile if it's new or modified
    if (gameName && selectedProfile === 'custom') {
      saveCustomProfile(true);
    }

    batchFileInputRef.current?.click();
  };

  const handleBatchFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const finalRegex = isCsvMode 
      ? `CSV_CONFIG:${JSON.stringify({ delimiter: csvDelimiter, quoteChar: csvQuoteChar, targetColumn: csvTargetColumn })}`
      : regexPattern;

    try {
      const zip = new JSZip();
      let processedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Read file with selected encoding
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file, encoding);
        });

        // Parse file
        const map = parseFileContent(content, file.name, finalRegex);
        map.gameName = gameName;
        map.regexPattern = finalRegex;
        map.encoding = encoding;

        // Generate clean text
        const cleanText = generateExportText(map);
        
        // Save clean text to zip
        const cleanFileName = `${map.fileName.replace(/\.[^/.]+$/, "")}_clean_lines.txt`;
        const cleanBlobPart = encodeText(cleanText, encoding);
        zip.file(cleanFileName, cleanBlobPart as BlobPart);

        // Save map to zip
        const mapFileName = `${map.fileName}.map.json`;
        const mapBlobPart = encodeText(JSON.stringify(map, null, 2), 'utf-8');
        zip.file(mapFileName, mapBlobPart as BlobPart);

        processedCount++;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${gameName || 'batch'}_processed_files.zip`);

      alert(`Hromadné spracovanie dokončené. Úspešne spracovaných súborov: ${processedCount}`);

    } catch (error: any) {
      console.error("Batch processing error:", error);
      alert("Nastala chyba pri hromadnom spracovaní: " + error.message);
    } finally {
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };

  const handleBatchMergeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const mapFiles: File[] = [];
    const textFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      if (files[i].name.endsWith('.json')) {
        mapFiles.push(files[i]);
      } else if (files[i].name.endsWith('.txt')) {
        textFiles.push(files[i]);
      }
    }

    if (mapFiles.length === 0 || textFiles.length === 0) {
      alert("Vyberte aspoň jeden .json súbor (mapu) a aspoň jeden .txt súbor (preklad).");
      if (batchMergeFileInputRef.current) batchMergeFileInputRef.current.value = '';
      return;
    }

    try {
      const zip = new JSZip();
      let processedCount = 0;

      for (const mapFile of mapFiles) {
        // Read map file
        const mapContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(mapFile, 'utf-8');
        });

        const projectMap: ProjectMap = JSON.parse(mapContent);
        
        // Find matching text file
        const baseName = projectMap.fileName.replace(/\.[^/.]+$/, "");
        
        // Try to find exact match or partial match
        let matchingTextFile = textFiles.find(f => f.name.includes(baseName));
        
        if (!matchingTextFile) {
          // Try matching by the map file name itself (without .map.json)
          const mapBaseName = mapFile.name.replace(/\.map\.json$/, "");
          matchingTextFile = textFiles.find(f => f.name.includes(mapBaseName));
        }

        if (matchingTextFile) {
          // Read text file
          const textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(matchingTextFile!, projectMap.encoding || 'utf-8');
          });

          // Merge
          const mergedContent = generateMergedFile(projectMap, textContent);
          
          // Save to zip
          const ext = projectMap.fileName.split('.').pop() || 'txt';
          const mergedFileName = `localized_${projectMap.fileName}`;
          const blobPart = encodeText(mergedContent, projectMap.encoding || 'utf-8');
          zip.file(mergedFileName, blobPart as BlobPart);
          
          processedCount++;
        }
      }

      if (processedCount === 0) {
        alert("Nepodarilo sa spárovať žiadne súbory. Uistite sa, že názvy preložených súborov obsahujú pôvodný názov súboru.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `batch_merged_files.zip`);

      alert(`Hromadné zloženie dokončené. Úspešne spracovaných súborov: ${processedCount}`);

    } catch (error: any) {
      console.error("Batch merge error:", error);
      alert("Nastala chyba pri hromadnom zložení: " + error.message);
    } finally {
      if (batchMergeFileInputRef.current) batchMergeFileInputRef.current.value = '';
    }
  };

  const handleLoadTestCsv = () => {
    const testCsvContent = `id,type,text,notes\n1,dialog,"Hello, world!",\n2,dialog,"This is a test.",\n3,ui,"Start Game",`;
    const file = new File([testCsvContent], "test_data.csv", { type: "text/csv" });
    
    setSelectedFile(file);
    setDetectedFileType('CSV (Comma Separated Values)');
    setIsCsvMode(true);
    setCsvDelimiter(',');
    setCsvQuoteChar('"');
    setCsvTargetColumn(2);
    setGameName('Testovacia Hra');
    
    const finalRegex = `CSV_CONFIG:${JSON.stringify({ delimiter: ',', quoteChar: '"', targetColumn: 2 })}`;
    
    const map = parseFileContent(testCsvContent, file.name, finalRegex);
    map.gameName = 'Testovacia Hra';
    map.regexPattern = finalRegex;
    map.encoding = 'utf-8';
    setProjectMap(map);
    setStep(2);
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.lines && json.fileName) {
          setProjectMap(json as ProjectMap);
          setStep(2); // Jump to export/merge step
        } else {
          alert("Neplatný súbor mapy (JSON).");
        }
      } catch (err) {
        alert("Chyba pri čítaní JSON mapy.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (mapFileInputRef.current) mapFileInputRef.current.value = '';
  };

  const handleTranslationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (projectMap) {
        const expectedCount = projectMap.lines.filter(l => l.isTranslatable).length;
        const translatedLines = content.split(/\r?\n/);
        
        let warnings: string[] = [];
        
        if (translatedLines.length !== expectedCount) {
          warnings.push(`Nesúlad v počte riadkov! Očakáva sa ${expectedCount} riadkov, ale nahraný súbor má ${translatedLines.length} riadkov.`);
        }

        // Check for empty translated lines
        const emptyLines = translatedLines.filter(line => line.trim() === '').length;
        if (emptyLines > 0) {
          warnings.push(`Súbor obsahuje ${emptyLines} prázdnych riadkov, čo môže znamenať chýbajúci preklad.`);
        }

        setValidationResult({
          isValid: warnings.length === 0,
          expectedCount,
          actualCount: translatedLines.length,
          warnings,
          content
        });
      }
    };
    reader.readAsText(file, projectMap?.encoding || 'utf-8');
    // Reset input
    if (translationInputRef.current) translationInputRef.current.value = '';
  };

  const proceedToMerge = () => {
    if (validationResult && projectMap) {
      setTranslatedContent(validationResult.content);
      const merged = generateMergedFile(projectMap, validationResult.content);
      setFinalOutput(merged);
      setStep(3);
      setValidationResult(null);
    }
  };

  const encodeText = (text: string, enc: string): BlobPart => {
    if (enc === 'utf-16le') {
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new Uint16Array(buffer);
      for (let i = 0; i < text.length; i++) {
        view[i] = text.charCodeAt(i);
      }
      return buffer;
    }
    if (enc === 'utf-16be') {
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < text.length; i++) {
        view.setUint16(i * 2, text.charCodeAt(i), false);
      }
      return buffer;
    }
    // Default to UTF-8
    return text;
  };

  const downloadFile = (filename: string, content: string, type: string = 'text/plain;charset=utf-8', enc: string = 'utf-8') => {
    const blobPart = encodeText(content, enc);
    const blob = new Blob([blobPart], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportClean = () => {
    if (!projectMap) return;
    const text = generateExportText(projectMap);
    downloadFile(`${projectMap.fileName.replace(/\\.[^/.]+$/, "")}_clean_lines.txt`, text, 'text/plain;charset=utf-8', projectMap.encoding || 'utf-8');
  };

  const handleExportMap = () => {
    if (!projectMap) return;
    downloadFile(`${projectMap.fileName}.map.json`, JSON.stringify(projectMap, null, 2), 'application/json', 'utf-8');
  };

  const handleDownloadFinal = () => {
    if (!finalOutput || !projectMap) return;
    // Ensure we use the proper name and mime type for the result
    const ext = projectMap.fileName.split('.').pop() || 'txt';
    downloadFile(`localized_${projectMap.fileName}`, finalOutput, `text/${ext};charset=utf-8`, projectMap.encoding || 'utf-8');
  };

  const reset = () => {
    setStep(1);
    setProjectMap(null);
    setTranslatedContent(null);
    setFinalOutput(null);
    setSelectedFile(null);
    setDetectedFileType('');
  };

  const filteredProfiles = gameProfiles.filter(p => p.name.toLowerCase().includes(profileSearchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-cyber-900 text-cyber-text font-sans selection:bg-cyber-accent selection:text-white pb-12">
      {/* Header */}
      <header className="border-b border-cyber-700 bg-cyber-800 py-6">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Universal - <span className="text-cyber-accent">Translator Helper</span></h1>
            <p className="text-sm text-gray-400 mt-1">Rozdeľ, prelož a spoj lokalizačné súbory hier</p>
            <p className="text-xs text-cyber-accent mt-1">Vytvoril: Flego</p>
          </div>
          {step > 1 && (
             <Button variant="secondary" onClick={reset} icon={<RefreshCw size={18} />}>
               Začať odznova
             </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-10 max-w-4xl space-y-8">
        
        {isManualMode && (
          <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center ${isManualFullscreen ? 'p-0' : 'p-4'}`}>
            <div className={`bg-cyber-800 flex flex-col border border-cyber-600 shadow-2xl transition-all duration-200 ${isManualFullscreen ? 'w-full h-full rounded-none border-0' : 'w-full max-w-5xl max-h-[90vh] rounded-xl'}`}>
              <div className={`p-4 border-b border-cyber-700 flex justify-between items-center bg-cyber-900/50 ${isManualFullscreen ? '' : 'rounded-t-xl'}`}>
                <h3 className="text-lg font-bold text-white flex items-center">
                  <Search className="mr-2 text-cyber-accent" size={20} />
                  Manuálna Analýza
                </h3>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setIsManualFullscreen(!isManualFullscreen)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-cyber-700 rounded transition-colors"
                    title={isManualFullscreen ? "Zmenšiť" : "Na celú obrazovku"}
                  >
                    {isManualFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                  <Button variant="secondary" onClick={() => setIsManualMode(false)}>Zrušiť</Button>
                  <Button onClick={handleGenerateManualRegex} disabled={isAnalyzing}>
                    {isAnalyzing ? "Generujem..." : "Vygenerovať Regex"}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-cyber-900/30 border-b border-cyber-700 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleMarkSelection('technical')} className="px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded text-sm hover:bg-orange-500/30 transition-colors">
                    Označiť Technickú časť (Oranžová)
                  </button>
                  <button onClick={() => handleMarkSelection('translatable')} className="px-3 py-1.5 bg-cyber-success/20 text-cyber-success border border-cyber-success/50 rounded text-sm hover:bg-cyber-success/30 transition-colors">
                    Označiť Text na preklad (Zelená)
                  </button>
                  <button onClick={() => handleMarkSelection('clear')} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/50 rounded text-sm hover:bg-red-500/30 transition-colors">
                    Zrušiť označenie výberu
                  </button>
                  <button onClick={() => setManualMarks({})} className="px-3 py-1.5 bg-gray-500/20 text-gray-400 border border-gray-500/50 rounded text-sm hover:bg-gray-500/30 transition-colors">
                    Vymazať všetko
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Zobraziť riadkov:</span>
                  {[5, 25, 50, 100].map(count => (
                    <button 
                      key={count}
                      onClick={() => setManualViewCount(count)}
                      className={`px-2 py-1 text-xs rounded border ${manualViewCount === count ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent' : 'bg-cyber-800 border-cyber-600 text-gray-400 hover:border-gray-500'}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre selection:bg-cyber-accent\/30 selection:text-white">
                {manualLines.slice(manualViewStart, manualViewStart + manualViewCount).map((line, idx) => {
                  const actualIndex = manualViewStart + idx;
                  return (
                    <div key={actualIndex} className="hover:bg-cyber-700/30 px-2 py-0.5 rounded -mx-2 flex">
                      <span className="text-gray-600 select-none mr-4 inline-block w-8 text-right shrink-0">{actualIndex + 1}</span>
                      <div className="flex-1" data-content-index={actualIndex}>
                        {renderManualLine(line, actualIndex)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`p-4 border-t border-cyber-700 flex justify-between items-center bg-cyber-900/50 ${isManualFullscreen ? '' : 'rounded-b-xl'}`}>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleManualViewChange(-100)} disabled={manualViewStart === 0}>-100</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(-50)} disabled={manualViewStart === 0}>-50</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(-25)} disabled={manualViewStart === 0}>-25</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(-5)} disabled={manualViewStart === 0}>-5</Button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Riadky {manualViewStart + 1} - {Math.min(manualViewStart + manualViewCount, manualLines.length)} z {manualLines.length}
                  </span>
                  <form onSubmit={handleGoToLineSubmit} className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={manualLines.length}
                      value={goToLineInput}
                      onChange={(e) => setGoToLineInput(e.target.value)}
                      placeholder="Choď na riadok..."
                      className="bg-cyber-800 border border-cyber-700 rounded px-2 py-1 text-sm text-white w-32 focus:outline-none focus:border-neon-blue"
                    />
                    <Button type="submit" variant="secondary" className="px-3 py-1 h-auto text-sm">Choď</Button>
                  </form>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleManualViewChange(5)} disabled={manualViewStart + manualViewCount >= manualLines.length}>+5</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(25)} disabled={manualViewStart + manualViewCount >= manualLines.length}>+25</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(50)} disabled={manualViewStart + manualViewCount >= manualLines.length}>+50</Button>
                  <Button variant="secondary" onClick={() => handleManualViewChange(100)} disabled={manualViewStart + manualViewCount >= manualLines.length}>+100</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Import */}
        <StepCard 
          title="Začať projekt" 
          stepNumber={1} 
          isActive={step === 1} 
          isCompleted={step > 1}
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Option A: New Project */}
              <div className="border border-cyber-600 rounded-lg p-6 bg-cyber-800/50">
                <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                  <FileText className="mr-2 text-cyber-accent" size={24} />
                  Nový preklad
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Herný profil</label>
                    <div className="mb-2 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Hľadať profil..." 
                        value={profileSearchQuery}
                        onChange={(e) => setProfileSearchQuery(e.target.value)}
                        className="w-full bg-cyber-900 border border-cyber-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent"
                      />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {filteredProfiles.map(profile => {
                        const Icon = profile.icon;
                        const isSelected = selectedProfile === profile.id;
                        return (
                          <div key={profile.id} className="relative flex-1 min-w-[80px]">
                            <button
                              onClick={() => handleProfileSelect(profile.id)}
                              className={`p-2 rounded flex flex-col items-center justify-center w-full h-full transition-colors border ${isSelected ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent' : 'bg-cyber-900 border-cyber-700 text-gray-400 hover:border-gray-500'}`}
                              title={profile.name}
                            >
                              <Icon size={20} className="mb-1" />
                              <span className="text-xs text-center break-words w-full line-clamp-2">{profile.name}</span>
                            </button>
                            {profile.isCustom && (
                              <button 
                                onClick={(e) => requestDeleteProfile(profile.id, e)}
                                className="absolute top-[1px] right-[1px] bg-red-900/40 text-red-400 hover:bg-red-600 hover:text-white w-7 h-7 flex items-start justify-end p-1.5 rounded-tr-[3px] rounded-bl-xl transition-colors"
                                title="Vymazať profil"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {filteredProfiles.length === 0 && (
                        <div className="col-span-full text-center py-4 text-sm text-gray-500">
                          Žiadne profily neboli nájdené.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-sm text-gray-400">Názov hry</label>
                    </div>
                    <input 
                      type="text" 
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="w-full bg-cyber-900 border border-cyber-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
                      placeholder="Napr. Moja Hra"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Kódovanie súboru</label>
                    <select 
                      value={encoding}
                      onChange={(e) => setEncoding(e.target.value)}
                      className="w-full bg-cyber-900 border border-cyber-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
                    >
                      <option value="utf-8">UTF-8 (Predvolené)</option>
                      <option value="utf-16le">UTF-16 LE</option>
                      <option value="utf-16be">UTF-16 BE</option>
                      <option value="windows-1250">Windows-1250 (Stredná Európa)</option>
                    </select>
                  </div>

                  <div className="flex items-center mb-2">
                    <label className="text-sm text-gray-400 mr-4">Režim parsovania:</label>
                    <label className="inline-flex items-center mr-4 cursor-pointer">
                      <input type="radio" className="form-radio text-cyber-accent" checked={!isCsvMode} onChange={() => setIsCsvMode(false)} />
                      <span className="ml-2 text-sm text-white">Regex</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="radio" className="form-radio text-cyber-accent" checked={isCsvMode} onChange={() => setIsCsvMode(true)} />
                      <span className="ml-2 text-sm text-white">CSV/TSV</span>
                    </label>
                  </div>

                  {!isCsvMode ? (
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-sm text-gray-400">Regulárny výraz (Regex)</label>
                        <button 
                          onClick={() => saveCustomProfile(false)}
                          className="text-xs text-cyber-accent hover:text-cyber-accentHover flex items-center"
                          title="Uložiť ako nový profil"
                        >
                          <Save size={14} className="mr-1" /> Uložiť profil
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={regexPattern}
                        onChange={(e) => setRegexPattern(e.target.value)}
                        className="w-full bg-cyber-900 border border-cyber-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyber-accent"
                        placeholder="^(.*)(text)(.*)$"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 bg-cyber-900/50 p-3 rounded border border-cyber-700">
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-sm text-gray-400">CSV/TSV Konfigurácia</label>
                        <button 
                          onClick={() => saveCustomProfile(false)}
                          className="text-xs text-cyber-accent hover:text-cyber-accentHover flex items-center"
                          title="Uložiť ako nový profil"
                        >
                          <Save size={14} className="mr-1" /> Uložiť profil
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Oddeľovač</label>
                          <input 
                            type="text" 
                            value={csvDelimiter}
                            onChange={(e) => setCsvDelimiter(e.target.value)}
                            className="w-full bg-cyber-900 border border-cyber-700 rounded px-2 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-cyber-accent"
                            placeholder=","
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Úvodzovky</label>
                          <input 
                            type="text" 
                            value={csvQuoteChar}
                            onChange={(e) => setCsvQuoteChar(e.target.value)}
                            className="w-full bg-cyber-900 border border-cyber-700 rounded px-2 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-cyber-accent"
                            placeholder='"'
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Cieľový stĺpec (od 0)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={csvTargetColumn}
                            onChange={(e) => setCsvTargetColumn(parseInt(e.target.value) || 0)}
                            className="w-full bg-cyber-900 border border-cyber-700 rounded px-2 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-cyber-accent"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProfile === 'custom' && (
                    <div className="pt-2 space-y-2">
                      <input 
                        type="file" 
                        ref={analyzerFileInputRef} 
                        onChange={handleAnalyzerUpload} 
                        className="hidden" 
                        accept=".txt,.json,.csv,.tsv,.xml,.ini,.yaml"
                      />
                      <input 
                        type="file" 
                        ref={manualFileInputRef} 
                        onChange={handleManualUpload} 
                        className="hidden" 
                        accept=".txt,.json,.csv,.tsv,.xml,.ini,.yaml"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          onClick={() => analyzerFileInputRef.current?.click()} 
                          className="flex-1 justify-center text-xs"
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? "Analyzujem..." : "Auto Analýza"}
                        </Button>
                        <Button 
                          variant="secondary" 
                          onClick={() => manualFileInputRef.current?.click()} 
                          className="flex-1 justify-center text-xs"
                          disabled={isAnalyzing}
                        >
                          Manuálna Analýza
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Umelá inteligencia prečíta začiatok súboru a navrhne správny formát.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-cyber-700">
                    {!selectedFile ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input 
                            type="file" 
                            ref={sourceFileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept=".txt,.json,.csv,.tsv,.xml"
                          />
                          <input 
                            type="file" 
                            ref={batchFileInputRef} 
                            onChange={handleBatchFileSelect} 
                            className="hidden" 
                            accept=".txt,.json,.csv,.tsv,.xml,.ini,.yaml"
                            multiple
                          />
                          <Button 
                            onClick={() => sourceFileInputRef.current?.click()} 
                            className="flex-1 justify-center"
                          >
                            Vybrať zdrojový súbor
                          </Button>
                          <Button 
                            variant="secondary"
                            onClick={handleLoadTestCsv} 
                            className="justify-center"
                            title="Načítať testovacie CSV"
                          >
                            Test CSV
                          </Button>
                        </div>
                        <Button 
                          variant="secondary"
                          onClick={handleBatchProcess} 
                          className="w-full justify-center border-dashed"
                          disabled={isCsvMode ? false : !regexPattern}
                        >
                          Hromadné spracovanie viacerých súborov
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-cyber-900 p-3 rounded border border-cyber-700 flex justify-between items-center">
                          <div>
                            <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                            <p className="text-xs text-gray-400">Detegovaný formát: <span className="text-cyber-accent">{detectedFileType}</span></p>
                          </div>
                          <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-white transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <Button 
                          onClick={processSelectedFile} 
                          className="w-full justify-center"
                          disabled={isCsvMode ? false : !regexPattern}
                        >
                          Spracovať súbor
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option B: Load Map */}
              <div className="border border-dashed border-cyber-600 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-cyber-accent transition-colors bg-cyber-900/30">
                <div className="mb-4 text-gray-500">
                   <Code size={48} />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Pokračovať v projekte</h4>
                <p className="text-sm text-gray-400 mb-6">Nahrajte .json mapu z predchádzajúcej extrakcie</p>
                <input 
                  type="file" 
                  ref={mapFileInputRef} 
                  onChange={handleMapUpload} 
                  className="hidden" 
                  accept=".json"
                />
                <input 
                  type="file" 
                  ref={batchMergeFileInputRef} 
                  onChange={handleBatchMergeFileSelect} 
                  className="hidden" 
                  accept=".json,.txt"
                  multiple
                />
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button variant="secondary" onClick={() => mapFileInputRef.current?.click()} className="justify-center">
                    Nahrať Mapu (.json)
                  </Button>
                  <Button variant="secondary" onClick={() => batchMergeFileInputRef.current?.click()} className="justify-center border-dashed">
                    Hromadné zloženie súborov
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </StepCard>

        {/* Step 2: Extract & Translate */}
        <StepCard 
          title="Extrakcia a Preklad" 
          stepNumber={2} 
          isActive={step === 2} 
          isCompleted={step > 2}
        >
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <h4 className="text-white font-medium flex items-center">
                  <span className="w-6 h-6 rounded-full bg-cyber-700 text-xs flex items-center justify-center mr-2">A</span>
                  Stiahnuť pracovné súbory
                </h4>
                <p className="text-sm text-gray-400">
                  1. Stiahnite si <strong className="text-white">Čistý text</strong> (.txt).<br/>
                  2. Stiahnite si <strong className="text-white">Mapu</strong> (.json). Túto mapu si bezpečne uložte!
                </p>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleExportClean} icon={<Download size={18} />}>
                    Čistý text (.txt)
                  </Button>
                  <Button variant="secondary" onClick={handleExportMap} icon={<Code size={18} />}>
                    Mapa (.json)
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-4 border-l border-cyber-700 pl-0 md:pl-6">
                <h4 className="text-white font-medium flex items-center">
                  <span className="w-6 h-6 rounded-full bg-cyber-700 text-xs flex items-center justify-center mr-2">B</span>
                  Nahrať preklad
                </h4>
                <p className="text-sm text-gray-400">
                  Nahrajte preložený TXT súbor. Počet riadkov musí presne sedieť s originálom.
                </p>
                <div className="pt-2">
                  <input 
                    type="file" 
                    ref={translationInputRef} 
                    onChange={handleTranslationUpload} 
                    className="hidden" 
                    accept=".txt"
                  />
                  <Button onClick={() => translationInputRef.current?.click()} icon={<Upload size={18} />}>
                    Nahrať preložený text
                  </Button>
                </div>
                
                {validationResult && (
                  <div className={`mt-4 p-4 rounded-lg border ${validationResult.isValid ? 'bg-cyber-success/10 border-cyber-success/50' : 'bg-red-900/20 border-red-500/50'}`}>
                    <h5 className={`font-medium mb-2 ${validationResult.isValid ? 'text-cyber-success' : 'text-red-400'}`}>
                      {validationResult.isValid ? 'Validácia úspešná' : 'Upozornenie pri validácii'}
                    </h5>
                    
                    <div className="text-sm text-gray-300 space-y-2 mb-4">
                      <p>Očakávaný počet riadkov: <span className="font-mono text-white">{validationResult.expectedCount}</span></p>
                      <p>Nájdený počet riadkov: <span className="font-mono text-white">{validationResult.actualCount}</span></p>
                      
                      {validationResult.warnings.length > 0 && (
                        <div className="mt-2 text-red-300">
                          <ul className="list-disc pl-5 space-y-1">
                            {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        onClick={proceedToMerge} 
                        variant={validationResult.isValid ? "primary" : "secondary"}
                        className={!validationResult.isValid ? "border-red-500/50 hover:bg-red-500/20 text-red-300" : ""}
                      >
                        {validationResult.isValid ? 'Pokračovať a zlúčiť' : 'Napriek tomu zlúčiť'}
                      </Button>
                      {!validationResult.isValid && (
                        <Button variant="secondary" onClick={() => setValidationResult(null)}>
                          Zrušiť
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Area */}
            {projectMap && (
              <div className="bg-cyber-900 rounded-lg border border-cyber-700 p-4">
                <h5 className="text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Náhľad analýzy zdrojového súboru</h5>
                <div className="font-mono text-sm space-y-1 h-48 overflow-y-auto">
                  {projectMap.lines.slice(0, 10).map((line) => (
                    <div key={line.id} className="flex">
                      <span className="text-gray-600 w-12 text-right mr-4 select-none">{line.id + 1}</span>
                      {line.isTranslatable ? (
                        <span className="text-cyber-success truncate">
                          <span className="text-gray-500 opacity-50">{line.prefix.replace(/\\t/g, '→')}</span>
                          <span className="bg-cyber-success/20 text-cyber-success px-1 rounded">{line.text}</span>
                          <span className="text-gray-500 opacity-50">{line.suffix.replace(/\\t/g, '→')}</span>
                        </span>
                      ) : (
                        <span className="text-gray-600 italic truncate">{line.originalContent}</span>
                      )}
                    </div>
                  ))}
                  <div className="text-gray-600 text-center italic mt-2">... celkovo {projectMap.lines.length} riadkov ...</div>
                </div>
              </div>
            )}
          </div>
        </StepCard>

        {/* Step 3: Finish */}
        <StepCard 
          title="Výsledok" 
          stepNumber={3} 
          isActive={step === 3} 
          isCompleted={false}
        >
          <div className="space-y-6">
             <div className="bg-cyber-success/10 border border-cyber-success/50 rounded-lg p-4 flex items-start">
                <div className="text-cyber-success mt-1 mr-3"><Check size={24} /></div>
                <div>
                  <h4 className="text-white font-medium">Spojenie bolo úspešné!</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Váš preložený text bol úspešne vložený späť do pôvodnej štruktúry súboru.
                  </p>
                </div>
             </div>

             {/* Diff View / Preview */}
             <div className="mt-4 border border-cyber-700 rounded-lg overflow-hidden bg-cyber-900 flex flex-col">
               <div className="flex justify-between items-center bg-cyber-950 border-b border-cyber-700 px-3 py-2">
                 <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Náhľad zmien</h5>
                 <div className="flex items-center gap-2">
                   <span className="text-xs text-gray-500">Zobraziť iba preložené</span>
                   <button 
                     onClick={() => setShowOnlyTranslated(!showOnlyTranslated)}
                     className={`w-8 h-4 rounded-full relative transition-colors ${showOnlyTranslated ? 'bg-cyber-accent' : 'bg-cyber-700'}`}
                   >
                     <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showOnlyTranslated ? 'translate-x-4' : 'translate-x-0'}`} />
                   </button>
                 </div>
               </div>
               <div className="flex bg-cyber-950 border-b border-cyber-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
                 <div className="w-12 border-r border-cyber-800 flex-shrink-0"></div>
                 <div className="flex-1 py-2 px-3 border-r border-cyber-800">Originál</div>
                 <div className="flex-1 py-2 px-3 text-cyber-accent">Preklad</div>
               </div>
               <div className="max-h-96 overflow-y-auto custom-scrollbar">
                 {(() => {
                   if (!projectMap || !finalOutput) return null;
                   
                   const diffRows = [];
                   
                   if (showOnlyTranslated) {
                     // Show only translatable lines
                     const translatableParts: { id: number, orig: string }[] = [];
                      projectMap.lines.filter(l => l.isTranslatable).forEach(l => {
                        if (l.parts && l.parts.length > 0) {
                          l.parts.filter(p => p.isTranslatable).forEach(p => {
                            translatableParts.push({ id: l.id, orig: p.text });
                          });
                        } else {
                          translatableParts.push({ id: l.id, orig: l.text });
                        }
                      });
                     const translatedLines = translatedContent?.split(/\r?\n/) || [];
                     
                     const linesToShow = Math.min(translatableParts.length, 100);
                     
                     for (let i = 0; i < linesToShow; i++) {
                       const orig = translatableParts[i].orig || '';
                       const fin = translatedLines[i] || '';
                       const isDiff = orig !== fin;
                       
                       diffRows.push(
                         <div key={i} className={`flex border-b border-cyber-800/50 ${isDiff ? 'bg-cyber-800/30' : 'hover:bg-cyber-800/20'}`}>
                           <div className="w-12 flex-shrink-0 text-right pr-2 py-1 text-xs text-cyber-700 select-none border-r border-cyber-800 bg-cyber-950 flex flex-col justify-center">
                             {translatableParts[i].id + 1}
                           </div>
                           <div className={`flex-1 overflow-x-auto whitespace-pre font-mono text-xs py-1.5 px-3 ${isDiff ? 'text-red-400/80 bg-red-900/10' : 'text-gray-500'}`}>
                             {orig || ' '}
                           </div>
                           <div className={`flex-1 overflow-x-auto whitespace-pre font-mono text-xs py-1.5 px-3 border-l border-cyber-800 ${isDiff ? 'text-green-400 bg-green-900/10' : 'text-gray-300'}`}>
                             {fin || ' '}
                           </div>
                         </div>
                       );
                     }
                     
                     return (
                       <>
                         {diffRows}
                         {translatableParts.length > linesToShow && (
                           <div className="py-3 text-center text-xs text-cyber-600 bg-cyber-950/50 border-t border-cyber-800">
                             ... a ďalších {translatableParts.length - linesToShow} preložených riadkov
                           </div>
                         )}
                       </>
                     );
                   } else {
                     // Show entire file
                     const originalLines = projectMap.lines.map(l => l.originalContent).join('\n').split(/\r?\n/);
                     const finalLines = finalOutput.split(/\r?\n/);
                     
                     const maxLines = Math.max(originalLines.length, finalLines.length);
                     const linesToShow = Math.min(maxLines, 100);
                     
                     for (let i = 0; i < linesToShow; i++) {
                       const orig = originalLines[i] || '';
                       const fin = finalLines[i] || '';
                       const isDiff = orig !== fin;
                       
                       diffRows.push(
                         <div key={i} className={`flex border-b border-cyber-800/50 ${isDiff ? 'bg-cyber-800/30' : 'hover:bg-cyber-800/20'}`}>
                           <div className="w-12 flex-shrink-0 text-right pr-2 py-1 text-xs text-cyber-700 select-none border-r border-cyber-800 bg-cyber-950 flex flex-col justify-center">
                             {i + 1}
                           </div>
                           <div className={`flex-1 overflow-x-auto whitespace-pre font-mono text-xs py-1.5 px-3 ${isDiff ? 'text-red-400/80 bg-red-900/10' : 'text-gray-500'}`}>
                             {orig || ' '}
                           </div>
                           <div className={`flex-1 overflow-x-auto whitespace-pre font-mono text-xs py-1.5 px-3 border-l border-cyber-800 ${isDiff ? 'text-green-400 bg-green-900/10' : 'text-gray-300'}`}>
                             {fin || ' '}
                           </div>
                         </div>
                       );
                     }
                     
                     return (
                       <>
                         {diffRows}
                         {maxLines > linesToShow && (
                           <div className="py-3 text-center text-xs text-cyber-600 bg-cyber-950/50 border-t border-cyber-800">
                             ... a ďalších {maxLines - linesToShow} riadkov
                           </div>
                         )}
                       </>
                     );
                   }
                 })()}
               </div>
             </div>

             <div className="flex justify-end pt-4">
                <Button onClick={handleDownloadFinal} icon={<Download size={18} />}>
                  Stiahnuť finálny súbor
                </Button>
             </div>
          </div>
        </StepCard>

      </main>

      {/* Delete Profile Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-cyber-900 border border-cyber-accent rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Vymazať profil?</h3>
            <p className="text-gray-400 mb-6">
              Naozaj chcete vymazať tento profil? Táto akcia je nevratná.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteProfile}
                className="px-4 py-2 rounded text-gray-300 hover:text-white hover:bg-cyber-800 transition-colors"
              >
                Zrušiť
              </button>
              <button
                onClick={confirmDeleteProfile}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
              >
                Vymazať
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;