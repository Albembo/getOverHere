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
    link.download = "getoverhere-rules.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    // TRUCCO UX: Se la finestra è più stretta di 780px, siamo nel micro-popup del browser.
    if (window.innerWidth < 780) {
      const confirmOpen = window.confirm(browser.i18n.getMessage("importWarning"));

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
          throw new Error(browser.i18n.getMessage("invalidFormat"));
        onRulesUpdated(importedRules);
        event.target.value = null;
      } catch (error) {
        alert(browser.i18n.getMessage("importErrorJson"));
      }
    };
    reader.readAsText(file);
  };

  return (
    <fieldset style={{ margin: 0 }}>
      <legend>{browser.i18n.getMessage("backupAndSync")}</legend>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleExport} title={browser.i18n.getMessage("exportTitle")}>
          {browser.i18n.getMessage("exportBtn")}
        </button>
        <button onClick={handleImportClick} title={browser.i18n.getMessage("importTitle")}>
          {browser.i18n.getMessage("importBtn")}
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
