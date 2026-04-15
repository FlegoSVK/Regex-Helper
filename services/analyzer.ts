import { GoogleGenAI, Type } from "@google/genai";

export const analyzeFileContent = async (content: string, gameName: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    return "";
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const lines = content.split(/\r?\n/).slice(0, 300).join('\n');
  
  const prompt = `
Si expert na analýzu lokalizačných súborov hier. Analyzuj nasledujúci text (prvých 300 riadkov zo súboru hry "${gameName}").
Tento súbor môže byť v rôznych formátoch (JSON, CSV, TSV, XML, INI, YAML, TXT atď.) a obsahuje technické značky/dáta a texty na preklad. 

Tvojou úlohou je presne identifikovať formát súboru a navrhnúť najlepší spôsob extrakcie textu na preklad (napr. dialógy, názvy predmetov, popisy, UI texty). Ignoruj technické kľúče, IDčka, cesty k súborom a čísla.

PRAVIDLÁ PRE ROZPOZNANIE FORMÁTU:
1. CSV/TSV: Ak vidíš jasnú tabuľkovú štruktúru oddelenú znakmi ako čiarka (,), bodkočiarka (;), alebo tabulátor (\\t), a texty na preklad sú v špecifickom stĺpci.
2. JSON: Ak vidíš štruktúru kľúč-hodnota s úvodzovkami a zloženými zátvorkami (napr. "dialogue_001": "Hello world").
3. XML: Ak vidíš tagy (napr. <text id="1">Hello world</text>).
4. INI/TXT: Ak vidíš štruktúru kľúč=hodnota (napr. dialogue_001=Hello world).

VÝSTUP:
Ak ide o CSV/TSV súbor:
Vráť konfiguráciu pre CSV parser vo formáte JSON stringu s prefixom "CSV_CONFIG:".
Napríklad: CSV_CONFIG:{"delimiter":",","quoteChar":"\\"","targetColumn":2}
- delimiter: znak, ktorý oddeľuje stĺpce (napr. ",", ";", "\\t")
- quoteChar: znak, ktorý obaľuje text v stĺpcoch (napr. "\\"", "'"). Ak sa nepoužíva, daj prázdny string "".
- targetColumn: index stĺpca (od 0), ktorý obsahuje text na preklad.

Ak ide o iný formát (JSON, XML, INI, TXT atď.):
Navrhni presný regulárny výraz (Regex) v JavaScripte, ktorý rozdelí riadok s textom na preklad presne na 3 zachytávajúce skupiny (capturing groups):
1. Prefix (všetko pred textom na preklad, vrátane kľúčov, úvodzoviek, tagov)
2. Text (samotný text na preklad)
3. Suffix (všetko za textom na preklad, vrátane uzatváracích úvodzoviek, čiarok, tagov)

Príklady Regexov:
- JSON: ^(.*?"[^"]+"\\s*:\\s*")(.*?)(".*?)$
- XML: ^(.*?>)(.*?)(<.*)$
- INI: ^(.*?=)(.*?)()$

Vráť IBA platný regulárny výraz ako string (bez lomítok na začiatku a konci). Regex musí byť dostatočne všeobecný, aby zachytil všetky relevantné riadky, ale dostatočne špecifický, aby nezachytil čisto technické riadky.
Dôležité: Ak sa text nedá analyzovať, vráť prázdny string.

Text na analýzu:
${lines}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regex: {
              type: Type.STRING,
              description: "Navrhnutý regulárny výraz",
            }
          },
          required: ["regex"]
        }
      }
    });
    
    const jsonStr = response.text?.trim();
    if (jsonStr) {
      const result = JSON.parse(jsonStr);
      return result.regex || "";
    }
    return "";
  } catch (error) {
    console.error("Error analyzing file:", error);
    return "";
  }
};

export const analyzeManualSelection = async (
  examples: { line: string; translatable: string; technical: string[] }[],
  gameName: string
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const ai = new GoogleGenAI({ apiKey });

  const examplesText = examples.map(e => `
Riadok: ${e.line}
Text na preklad (Zelená): ${e.translatable}
Technická časť (Oranžová): ${e.technical.join(', ')}
  `).join('\n');

  const prompt = `
Si expert na analýzu lokalizačných súborov hier. Používateľ manuálne označil časti textu v lokalizačnom súbore hry "${gameName}". Súbor môže byť v akomkoľvek formáte (JSON, CSV, TSV, XML, INI, TXT atď.).

Tvojou úlohou je zistiť formát na základe označených príkladov a navrhnúť presný spôsob, ako z neho extrahovať text na preklad.

PRAVIDLÁ PRE ROZPOZNANIE FORMÁTU:
1. CSV/TSV: Ak riadky vyzerajú ako tabuľkové dáta oddelené znakmi (,, ;, \\t) a označený text je vždy v rovnakom stĺpci.
2. Ostatné formáty (JSON, XML, INI): Ak riadky obsahujú štruktúry ako kľúč-hodnota, tagy, atď.

VÝSTUP:
Ak ide o CSV/TSV súbor:
Vráť konfiguráciu pre CSV parser vo formáte JSON stringu s prefixom "CSV_CONFIG:".
Napríklad: CSV_CONFIG:{"delimiter":",","quoteChar":"\\"","targetColumn":2}
- delimiter: znak, ktorý oddeľuje stĺpce (napr. ",", ";", "\\t")
- quoteChar: znak, ktorý obaľuje text v stĺpcoch (napr. "\\"", "'"). Ak sa nepoužíva, daj prázdny string "".
- targetColumn: index stĺpca (od 0), ktorý obsahuje text na preklad (Zelená).

Ak ide o iný formát (JSON, XML, INI, TXT atď.):
Navrhni presný regulárny výraz (Regex) v JavaScripte, ktorý rozdelí takýto riadok presne na nepárny počet zachytávajúcich skupín (capturing groups) na základe vzoru z príkladov:
1. Prefix (všetko pred prvým textom na preklad)
2. Text 1 (prvý text na preklad, Zelená)
3. Technická časť 1 (Oranžová)
4. Text 2 (druhý text na preklad, Zelená)
...
N. Suffix (všetko za posledným textom na preklad)

Počet skupín musí byť vždy nepárny (3, 5, 7 atď.). Prvá skupina je vždy Prefix, posledná je vždy Suffix. Párne skupiny (2, 4, 6...) sú vždy texty na preklad (Zelená). Nepárne skupiny medzi nimi (3, 5...) sú technické časti (Oranžová).
Ak je v riadku len jeden text na preklad, budú to presne 3 skupiny (Prefix, Text, Suffix).

Vráť IBA platný regulárny výraz ako string (bez lomítok na začiatku a konci). Regex musí byť robustný.

Tu sú príklady od používateľa:
${examplesText}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regex: {
              type: Type.STRING,
              description: "Navrhnutý regulárny výraz",
            }
          },
          required: ["regex"]
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (jsonStr) {
      const result = JSON.parse(jsonStr);
      return result.regex || "";
    }
    return "";
  } catch (error) {
    console.error("Error analyzing manual selection:", error);
    return "";
  }
};
