import { useRef } from "preact/hooks";
import browser from "webextension-polyfill";

export function RulesManager({ rules, onRulesUpdated }) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const jsonString = JSON.stringify(rules, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "devproxy-rules.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    // TRUCCO UX: Se la finestra è più stretta di 780px, siamo nel micro-popup del browser.
    if (window.innerWidth < 780) {
      const confirmOpen = window.confirm(
        "⚠️ Il browser chiuderà questa finestrella non appena aprirai il file manager.\n\nClicca OK per aprire DevProxy in una scheda intera e importare il JSON in sicurezza!",
      );

      if (confirmOpen) {
        // Apriamo la scheda intera!
        browser.tabs.create({ url: browser.runtime.getURL("index.html") });
      }
      return; // Blocchiamo l'apertura del file picker qui nel popup
    }

    // Se siamo già nella scheda intera, apriamo il file picker tranquillamente
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedRules = JSON.parse(e.target.result);
        if (!Array.isArray(importedRules))
          throw new Error("Formato non valido");
        onRulesUpdated(importedRules);
        event.target.value = null;
      } catch (error) {
        alert(
          "Errore caricamento JSON: Il file potrebbe essere corrotto o avere un formato errato.",
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <fieldset style={{ margin: 0 }}>
      <legend>Backup & Sync</legend>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleExport} title="Salva le regole in un file">
          💾 Esporta JSON
        </button>
        <button onClick={handleImportClick} title="Carica regole da un file">
          📁 Importa JSON
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>
    </fieldset>
  );
}
