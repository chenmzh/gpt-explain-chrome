# GPT Spiegazione nella Pagina

> **Italiano** · [简体中文](README.md) · [English](README-EN.md)

Seleziona del testo in Chrome, Chromium o Microsoft Edge e chiedi a GPT di spiegarlo in una finestra popup indipendente. Puoi scegliere Codex con un abbonamento ChatGPT, l'API diretta DeepSeek V4 Flash, oppure DeepSeek tramite Reasonix CLI.

> 在 Chrome、Chromium 或 Microsoft Edge 中选中文字，右键选择“用 GPT 解释”，可通过本机 Codex CLI、DeepSeek V4 Flash 直连 API，或 Reasonix CLI 生成解释。

![Finestra di spiegazione indipendente: Markdown, formule e cambio lingua](popup-preview-v0.3.1.png)

Questa è un'estensione Chrome o Edge multipiattaforma per uso personale, su macOS / Windows / Linux. Un'estensione del browser non può avviare programmi nativi da sola, quindi il progetto è composto da due parti:

- `extension/`: un'estensione del browser Manifest V3 responsabile del menu contestuale, delle finestre dei risultati indipendenti e delle impostazioni.
- `native-host/`: un Native Messaging Host che invoca in modo sicuro la CLI Codex con accesso effettuato, l'API DeepSeek o la CLI Reasonix in isolamento.

## Funzionalità

- Spiega il testo selezionato dal menu contestuale con il tasto destro
- Mostra origine, stato di generazione e risposta in una finestra Chrome indipendente, spostabile e ridimensionabile
- Seleziona di nuovo del testo in una finestra di spiegazione per aprire una finestra figlia indipendente che eredita il contesto
- Ogni spiegazione e domanda successiva viene salvata automaticamente in una libreria locale, consultabile anche dopo aver chiuso le finestre o riavviato il browser
- Le finestre figlie conservano puntatori di origine precisi, così puoi tornare alla finestra madre o elencare tutte le spiegazioni a valle
- La libreria supporta ricerca full-text, dettagli dei record, esportazione JSON e un grafico delle relazioni tra finestre
- Più finestre di spiegazione si dispongono automaticamente negli spazi di lavoro dei monitor per evitare sovrapposizioni quando possibile
- Ogni finestra mantiene la propria conversazione multi-turno; i dialoghi non si influenzano a vicenda
- Rendering Markdown locale e sicuro con Marked + DOMPurify, e rendering matematico locale con KaTeX
- Riutilizza un app-server Codex persistente e mostra le risposte in streaming, pezzo per pezzo
- Supporta l'API ufficiale di streaming Chat Completions di DeepSeek V4 Flash, con possibilità di disattivare il thinking oppure selezionare High o Max
- Supporta DeepSeek V4 Flash tramite la CLI Reasonix; Reasonix gira in una directory di configurazione temporanea separata e non carica la tua configurazione MCP
- Copia, interrompi e spiega di nuovo
- Predefinito Luna / XHigh, passabile a Luna / Max, Sol / Medium, Sol / High, oppure un modello personalizzato come GPT-5.6 Sol, Terra, Luna e altri
- Legge dinamicamente i modelli disponibili dal tuo account ChatGPT corrente; ripiega sul modello predefinito dell'account quando una vecchia configurazione non è disponibile
- La politica delle prestazioni riempie solo le combinazioni consigliate; la tua scelta esplicita di modello o reasoning vince sempre nell'interfaccia
- Scegli reasoning Low, Medium, High, Extra High, Max o Ultra
- Cambia la lingua della risposta direttamente nella finestra di spiegazione tra English (predefinita per le nuove installazioni), Simplified Chinese, Deutsch, Français, Italiano, oppure segui l'originale; vale dalla spiegazione o domanda successiva
- La pagina delle impostazioni segue automaticamente la lingua del browser oppure può essere impostata manualmente tra English, Simplified Chinese, Deutsch, Français, Italiano; lingua dell'interfaccia e lingua delle risposte sono indipendenti
- Controlla lo stato di accesso Codex, la chiave API DeepSeek o lo stato della CLI Reasonix per il provider corrente
- Gestisce fino a 50.000 caratteri per richiesta

## Requisiti di Sistema

- macOS, Windows 10 / 11 a 64 bit, oppure Linux (Chrome, Chromium o Edge)
- Google Chrome 116 o successivo (oppure Chromium / Microsoft Edge)
- Node.js 18 o successivo
- Almeno uno dei seguenti provider:
  - Codex CLI 0.144.0 o successivo, più un account ChatGPT che può usare Codex
  - Una chiave API DeepSeek (per l'API diretta DeepSeek V4 Flash)
  - CLI Reasonix più una chiave API DeepSeek (installazione con `npm install -g reasonix`)

Quando usi Codex, verifica prima di aver effettuato l'accesso:

```bash
codex --version
codex login
codex login status
```

Se la versione è troppo vecchia, aggiorna Codex con il tuo metodo di installazione, ad esempio `npm install -g @openai/codex@latest`. Quando usi DeepSeek, seleziona il provider nella pagina delle impostazioni dell'estensione e salva la chiave API nell'Host locale; la chiave non entra mai nello storage di Chrome.

## Installazione

### 1. Caricare l'estensione del browser

1. Apri `chrome://extensions` in Chrome oppure `edge://extensions` in Microsoft Edge.
2. Attiva la **Modalità sviluppatore** in alto a destra.
3. Clicca **Carica estensione non pacchettizzata**.
4. Seleziona la cartella `extension` di questo progetto.
5. Prendi nota dell'"ID estensione" di 32 caratteri mostrato sulla scheda dell'estensione.

### 2. Installare il Native Host

#### macOS

In un terminale nella directory del progetto, esegui:

```bash
chmod +x native-host/install-macos.sh native-host/uninstall-macos.sh
./native-host/install-macos.sh IL_TUO_ID_ESTENSIONE
```

L'installer:

- Trova automaticamente `node` usato dal terminale corrente e rileva `codex` e `reasonix` secondo necessità
- Installa l'Host in `~/Library/Application Support/GPTExplainBridge`
- Crea il manifest Native Messaging `com.codex.gpt_explainer` per Chrome
- Consente solo all'ID estensione che passi di connettersi all'Host

Dopo l'installazione, apri "Dettagli" → "Opzioni estensione" dell'estensione e clicca "Verifica connessione".

#### Linux

In un terminale nella directory del progetto, esegui:

```bash
chmod +x native-host/install-linux.sh native-host/uninstall-linux.sh
./native-host/install-linux.sh IL_TUO_ID_ESTENSIONE
```

L'installer:

- Trova automaticamente `node` usato dal terminale corrente e rileva `codex` e `reasonix` secondo necessità
- Installa l'Host in `~/.local/share/GPTExplainBridge`
- Crea il manifest Native Messaging `com.codex.gpt_explainer` per Chrome in `~/.config/google-chrome/NativeMessagingHosts/`
- Consente solo all'ID estensione che passi di connettersi all'Host

Per registrare anche Chromium o Edge, passa una lista di browser separata da virgole come secondo argomento:

```bash
./native-host/install-linux.sh IL_TUO_ID_ESTENSIONE chrome,chromium,edge
```

- Chromium usa `~/.config/chromium/NativeMessagingHosts/` ed Edge usa `~/.config/microsoft-edge/NativeMessagingHosts/`
- La stessa cartella `extension` ottiene lo stesso ID estensione in Chrome, Chromium ed Edge

Dopo l'installazione, apri "Dettagli" → "Opzioni estensione" dell'estensione e clicca "Verifica connessione".

#### Windows

In PowerShell nella directory del progetto, esegui:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\install-windows.ps1 -ExtensionId IL_TUO_ID_ESTENSIONE
```

Puoi anche usare il pacchetto di condivisione Windows e fare doppio clic su `Install-Windows.cmd`. L'installer:

- Trova automaticamente `node.exe` usato dall'utente Windows corrente e rileva Codex e Reasonix CLI secondo necessità; supporta sia i launcher nativi `.exe` che i `.cmd` npm
- Installa l'Host in `%LOCALAPPDATA%\GPTExplainBridge`
- Registra il manifest Native Messaging in `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.codex.gpt_explainer` senza bisogno di diritti di amministratore
- Supporta anche Microsoft Edge: di default l'installer registra inoltre in `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.codex.gpt_explainer`; apri `edge://extensions` in Edge e carica la stessa cartella `extension` (la stessa cartella ottiene lo stesso ID estensione in Chrome ed Edge)
- Consente solo all'ID estensione che passi di connettersi all'Host

Per registrare solo Chrome o solo Edge, passa `-Browsers chrome` o `-Browsers edge`.

Dopo l'installazione, ricarica l'estensione, apri "Opzioni estensione" e clicca "Verifica connessione".

### Installare per altre persone

I tre sistemi usano pacchetti di condivisione dai nomi chiari: `GPT-Explain-Chrome-macOS-v0.4.3.zip`, `GPT-Explain-Chrome-Windows-v0.4.3.zip` e `GPT-Explain-Chrome-Linux-v0.4.3.zip`. Contengono solo l'estensione, l'installer Native Host corrispondente e le istruzioni — nessun `config.json` generato localmente, nessun accesso Codex e nessuna chiave API. Su macOS fai doppio clic su `Install.command`; su Windows fai doppio clic su `Install-Windows.cmd`; su Linux esegui `native-host/install-linux.sh`. Poi configura con il tuo ID estensione e il tuo account o la tua chiave API.

Chrome normalmente blocca le installazioni CRX dall'esterno del Chrome Web Store, quindi la versione di condivisione per uso personale usa "carica la cartella `extension` non pacchettizzata + un installer Host locale". Per un'installazione pubblica con un clic e gli aggiornamenti automatici, dovresti comunque pubblicare sul Chrome Web Store e distribuire separatamente l'installer Native Host.

### 3. Utilizzo

1. Apri una normale pagina web.
2. Seleziona un pezzo di testo e clicca con il tasto destro.
3. Clicca "Spiega con GPT…".
4. La risposta appare in una finestra Chrome indipendente.
5. Seleziona di nuovo del testo nella risposta per aprire una nuova finestra figlia che eredita il contesto corrente.
6. Scrivi una domanda in fondo alla finestra per continuare la conversazione corrente; premi Invio per inviare, Shift+Invio per un nuovo paragrafo.

Nella pagina delle impostazioni dell'estensione puoi scegliere il provider AI, la modalità di thinking DeepSeek, il modello Codex e l'intensità del reasoning, la lingua della risposta, la lunghezza della risposta e il template del prompt.

## Variabili del Template del Prompt

I prompt personalizzati supportano:

- `{{text}}`: il testo selezionato
- `{{title}}`: il titolo della pagina
- `{{url}}`: l'URL della pagina
- `{{language}}`: il valore dell'impostazione della lingua

Se il template non contiene `{{text}}`, l'Host aggiunge automaticamente il testo selezionato alla fine.

## Sicurezza e Privacy

- L'estensione non legge, copia o salva mai `~/.codex/auth.json`.
- L'accesso a ChatGPT è gestito dal `codex login` ufficiale.
- La chiave API DeepSeek è salvata solo nel `config.json` del Native Host locale, mai nello storage di Chrome e mai nel pacchetto di condivisione; su macOS il permesso del file è `600`, su Windows il file si trova nel `%LOCALAPPDATA%` dell'utente corrente.
- Il testo selezionato va direttamente dal Native Messaging di Chrome all'Host locale e poi al provider scelto; il progetto non ha server propri.
- L'Host avvia Codex con un array di argomenti di `spawn` Node, con `shell` esplicitamente disabilitata.
- Reasonix usa un `reasonix run` monouso, con `shell` esplicitamente disabilitata; il processo figlio usa una directory di configurazione utente temporanea vuota, quindi non carica i tuoi server MCP, il `.env` o la configurazione di progetto.
- Nomi dei modelli, valori di reasoning, dimensioni dei messaggi e lunghezze del testo sono tutti validati.
- Il Native Host mantiene un processo `codex app-server` locale; ogni spiegazione crea un thread effimero e gira come turno con sandbox `read-only`, approvazione `never` e rete disabilitata.
- Il prompt tratta esplicitamente il testo della pagina selezionata come dati non attendibili e richiede al modello di non eseguire strumenti.
- Le risposte sono parse dal Marked incluso, sanificate dalla lista bianca DOMPurify inclusa, e la matematica è resa da KaTeX con `trust: false`; l'output del modello non è mai trattato come HTML attendibile.

Nota: il contenuto viene inviato al servizio OpenAI/Codex o DeepSeek che scegli, soggetto alle regole di controllo dei dati, abbonamento o fatturazione di quel servizio. Non chiedere di spiegare password, chiavi o altre informazioni sensibili che non dovrebbero essere inviate a un modello.

## Risoluzione dei Problemi

### "Specified native messaging host not found"

Di solito è un ID estensione non corrispondente. Ricopia l'ID da `chrome://extensions` ed esegui di nuovo l'installer.

### `env: node: No such file or directory`

Le versioni precedenti dell'Host non aggiungevano il percorso Homebrew per Chrome. Esegui di nuovo l'installer dal progetto corrente, poi verifica di nuovo la connessione dalla pagina delle impostazioni dell'estensione.

### "Codex non ha effettuato l'accesso"

Esegui, come stesso utente macOS:

```bash
codex login
codex login status
```

### Modello non disponibile

I modelli disponibili variano in base al piano ChatGPT, alle politiche dello spazio di lavoro e alla versione di Codex. Scegli prima "Codex raccomandato (auto)"; puoi anche aggiornare Codex e riprovare a specificare un modello.

### Le modifiche al codice non hanno effetto

Clicca il pulsante di aggiornamento sulla scheda dell'estensione in `chrome://extensions`. Se il Native Host è cambiato, esegui di nuovo l'installer.

## Disinstallazione

macOS:

```bash
./native-host/uninstall-macos.sh
```

Linux:

```bash
./native-host/uninstall-linux.sh
```

Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\uninstall-windows.ps1
```

Poi rimuovi l'estensione da `chrome://extensions` (o `edge://extensions`).

## Sviluppo e Verifica

Il progetto non richiede `npm install`; KaTeX, Marked e DOMPurify sono inclusi come asset statici lato browser:

```bash
npm test
npm run check
```

Crea la directory di installazione macOS condivisibile e lo ZIP:

```bash
bash scripts/build-distribution.sh
```

Crea la directory di installazione Linux con nome separato e lo ZIP:

```bash
bash scripts/build-distribution-linux.sh
```

Crea la directory di installazione Windows con nome separato e lo ZIP:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-distribution-windows.ps1
```

Gli artefatti vanno nella directory `dist/` ignorata da Git. GitHub Actions esegue gli stessi test e controlli a ogni push e pull request.

`npm test` verifica la validazione dei messaggi, l'isolamento del prompt, gli argomenti dell'app-server, gli eventi di streaming e il protocollo Native Messaging; `npm run check` verifica il Manifest, le dipendenze delle pagine e la sintassi JavaScript e degli script shell.

## Limitazioni Attuali

- L'installer Windows dipende dal Windows PowerShell e dal .NET Framework integrati per generare il launcher Native Host per utente.
- Il Native Host deve essere installato su ogni macchina individualmente; il Chrome Web Store non può installarlo da solo.
- La finestra indipendente è una normale popup di Chrome; Chrome non fornisce un'impostazione forzata "sempre in primo piano" per le estensioni.
- La disposizione è limitata dall'area dello schermo disponibile; quando sono aperte troppe finestre, Chrome non può garantire una posizione visibile completamente non sovrapposta.
- La disponibilità e le quote dei modelli sono determinate dal piano ChatGPT, dalle impostazioni dello spazio di lavoro e dalla versione corrente di Codex.
- La modalità Reasonix passa il compito attraverso lo standard input e usa un `REASONIX_HOME` separato con una directory strumenti esplicitamente vuota; come gli altri provider supporta testo selezionato fino a 50.000 caratteri.
