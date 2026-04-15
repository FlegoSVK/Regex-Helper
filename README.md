# Universal - Translator Helper

**Universal - Translator Helper** je výkonný nástroj navrhnutý pre prekladateľov a lokalizátorov hier. Pomáha automatizovať proces extrakcie textu z rôznych formátov lokalizačných súborov, umožňuje ich preklad v čistom textovom prostredí a následne ich bezpečne skladá späť do pôvodnej štruktúry.

## 🚀 Hlavné Funkcie

### 1. Inteligentná Extrakcia Textu
- **AI Analýza:** Využíva Gemini AI na automatické rozpoznanie formátu súboru (JSON, XML, CSV, INI, atď.) a navrhnutie optimálneho regulárneho výrazu (Regex) pre extrakciu.
- **Manuálna Analýza:** Umožňuje používateľovi manuálne označiť, ktoré časti riadku sú text na preklad a ktoré sú technické dáta.
- **Podpora viacerých segmentov:** Unikátna funkcia, ktorá dovoľuje označiť **viacero prekladateľných častí v rámci jedného riadku**, čo je ideálne pre zložité dialógové systémy s vloženými kódmi.

### 2. Správa Projektov
- **Mapovacie súbory (.json):** Aplikácia generuje mapu projektu, ktorá uchováva pôvodnú štruktúru súboru, zatiaľ čo prekladateľ pracuje len s čistým textom.
- **Export pre preklad:** Vygeneruje jednoduchý `.txt` súbor, ktorý obsahuje iba riadky určené na preklad, pripravený pre CAT nástroje alebo DeepL/Google Translate.

### 3. Hromadné Skladanie (Batch Reassembly)
- Umožňuje nahrať viacero mapovacích súborov a k nim prislúchajúce preložené texty naraz.
- Automaticky spáruje súbory podľa názvu a vygeneruje finálne lokalizované súbory zabalené v ZIP archíve.

### 4. Náhľad zmien (Diff View)
- Pred finálnym uložením si môžete zobraziť porovnanie pôvodného a nového textu.
- Farebné zvýraznenie zmien pomáha odhaliť chyby v preklade alebo formátovaní.

## 🛠 Ako to funguje (3-krokový proces)

1. **KROK 1: Import a Analýza**
   - Nahrajte lokalizačný súbor hry.
   - Vyberte profil hry alebo použite AI/Manuálnu analýzu na určenie formátu.
   - Stiahnite si **Mapu projektu** a **Text na preklad**.

2. **KROK 2: Preklad**
   - Preložte stiahnutý `.txt` súbor. Zachovajte počet riadkov (jeden riadok v súbore = jeden segment v mape).

3. **KROK 3: Zloženie**
   - Nahrajte Mapu projektu a váš Preložený text.
   - Skontrolujte zmeny v náhľade.
   - Stiahnite si finálny lokalizovaný súbor v pôvodnom formáte.

## 💻 Technické informácie

- **Frontend:** React, Tailwind CSS (Cyberpunk/Dark téma).
- **AI:** Integrácia Google Gemini API pre pokročilú analýzu textu.
- **Spracovanie dát:** PapaParse (CSV), JSZip (hromadné spracovanie).
- **Bezpečnosť:** Všetko spracovanie prebieha v prehliadači, vaše súbory nie sú trvalo ukladané na server.

---
**Vytvoril:** Flego
**Verzia:** 2.0 (Multi-segment support update)
