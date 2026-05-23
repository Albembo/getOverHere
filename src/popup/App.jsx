import { useState, useEffect } from "preact/hooks";
import browser from "webextension-polyfill";
import { RulesManager } from "./RulesManager.jsx";

// Utility: Generatore rapido di ID univoci
const generateId = () => Math.random().toString(36).substr(2, 9);

export function App() {
  // --- STATO GLOBALE ---
  // Array di tutti i profili salvati
  const [environments, setEnvironments] = useState([]);

  // ID del profilo attualmente selezionato nel menu a tendina (per visualizzarne le regole)
  const [currentEnvId, setCurrentEnvId] = useState(null);

  // Interruttore Master della Rete
  const [isProxyActive, setIsProxyActive] = useState(false);

  // --- 1. INIZIALIZZAZIONE ---
  useEffect(() => {
    browser.storage.local.get(["environments", "proxyStatus"]).then((res) => {
      // Se non ci sono ambienti salvati, ne creiamo uno di base
      const loadedEnvs =
        res.environments && res.environments.length > 0
          ? res.environments
          : [
              {
                id: generateId(),
                name: browser.i18n.getMessage("newEnvDefault"),
                rules: [],
                isCurrent: true,
              },
            ];

      setEnvironments(loadedEnvs);
      setIsProxyActive(res.proxyStatus !== undefined ? res.proxyStatus : false);

      // Impostiamo la visualizzazione sull'ambiente "isCurrent" (quello attivo in rete)
      const activeEnv =
        loadedEnvs.find((env) => env.isCurrent) || loadedEnvs[0];
      setCurrentEnvId(activeEnv.id);
    });
  }, []);

  // --- 2. MOTORE DI RETE ---
  // Salva nello storage e manda al background SOLO le regole dell'ambiente "isCurrent"
  const syncNetwork = async (envs, proxyState) => {
    await browser.storage.local.set({
      environments: envs,
      proxyStatus: proxyState,
    });

    const activeEnv = envs.find((e) => e.isCurrent);
    // Se l'interruttore Master è acceso e c'è un ambiente attivo, prendi quelle regole. Altrimenti array vuoto.
    const rulesToApply = proxyState && activeEnv ? activeEnv.rules : [];

    await browser.runtime.sendMessage({
      action: "UPDATE_RULES",
      rules: rulesToApply,
    });
  };

  // --- 3. GESTIONE DEI PROFILI ---
  const createEnvironment = () => {
    const newName = prompt(
      browser.i18n.getMessage("newEnvPrompt"),
      browser.i18n.getMessage("newEnvDefault"),
    );
    if (!newName) return;

    const newEnv = {
      id: generateId(),
      name: newName,
      rules: [],
      isCurrent: false,
    };
    const updated = [...environments, newEnv];
    setEnvironments(updated);
    setCurrentEnvId(newEnv.id); // Lo mostriamo subito
    syncNetwork(updated, isProxyActive);
  };

  const deleteCurrentEnvironment = () => {
    if (environments.length <= 1) {
      alert(browser.i18n.getMessage("minEnvWarning"));
      return;
    }

    const confirmDelete = window.confirm(
      browser.i18n.getMessage("deleteEnvConfirm"),
    );
    if (!confirmDelete) return;

    const updated = environments.filter((e) => e.id !== currentEnvId);
    setEnvironments(updated);

    // Selezioniamo il primo disponibile come fallback
    setCurrentEnvId(updated[0].id);

    // Se abbiamo eliminato quello attivo sulla rete, passiamo la corona al fallback
    if (environments.find((e) => e.id === currentEnvId)?.isCurrent) {
      updated[0].isCurrent = true;
    }

    syncNetwork(updated, isProxyActive);
  };

  // Imposta il profilo attualmente visualizzato come "Quello che decide le regole di rete"
  const setAsActiveNetworkProfile = () => {
    const updated = environments.map((env) => ({
      ...env,
      isCurrent: env.id === currentEnvId,
    }));
    setEnvironments(updated);
    syncNetwork(updated, isProxyActive);
  };

  // --- 4. GESTIONE DELLE SINGOLE REGOLE ---
  // Lavoriamo sempre e solo sulle regole dell'ambiente attualmente visualizzato nel dropdown
  const currentEnv =
    environments.find((e) => e.id === currentEnvId) || environments[0];

  const updateCurrentEnvRules = (newRules) => {
    const updatedEnvs = environments.map((env) =>
      env.id === currentEnvId ? { ...env, rules: newRules } : env,
    );
    setEnvironments(updatedEnvs);
    syncNetwork(updatedEnvs, isProxyActive);
  };

  const addEmptyRule = () => {
    const newRule = {
      id: generateId(),
      type: "redirect",
      sourceUrl: "",
      targetUrl: "",
      active: true,
    };
    updateCurrentEnvRules([...currentEnv.rules, newRule]);
  };

  const updateRule = (ruleId, field, value) => {
    const updatedRules = currentEnv.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, [field]: value } : rule,
    );
    updateCurrentEnvRules(updatedRules);
  };

  const deleteRule = (ruleId) => {
    const updatedRules = currentEnv.rules.filter((rule) => rule.id !== ruleId);
    updateCurrentEnvRules(updatedRules);
  };

  const toggleAllRules = (forceState) => {
    const updatedRules = currentEnv.rules.map((rule) => ({
      ...rule,
      active: forceState,
    }));
    updateCurrentEnvRules(updatedRules);
  };

  // --- 5. IMPORTAZIONE & UTILITIES ---
  const handleImport = (importedEnvs) => {
    try {
      // Normalizziamo le chiavi per tollerare formati leggermente diversi
      const normalized = importedEnvs.map((env) => ({
        id: env.id || env.environmentId || generateId(),
        name: env.name || env.environmentName || browser.i18n.getMessage("importedProfile"),
        isCurrent: env.isCurrent !== undefined ? env.isCurrent : false,
        rules: (env.rules || []).map((r) => ({
          id: r.id || generateId(),
          type: r.type || "redirect",
          sourceUrl: r.sourceUrl || "",
          targetUrl: r.targetUrl || "",
          active: r.active !== undefined ? r.active : true,
        })),
      }));

      if (normalized.length > 0) {
        // Garantiamo che ci sia almeno un profilo corrente
        if (!normalized.some((e) => e.isCurrent)) {
          normalized[0].isCurrent = true;
        }

        setEnvironments(normalized);
        const activeEnv = normalized.find((e) => e.isCurrent) || normalized[0];
        setCurrentEnvId(activeEnv.id);
        syncNetwork(normalized, isProxyActive);
        alert(browser.i18n.getMessage("importSuccess"));
      }
    } catch (err) {
      alert(browser.i18n.getMessage("importError"));
    }
  };

  const openFullPage = () => {
    // Apri l'estensione in una nuova scheda per gestire file senza crash
    browser.tabs.create({ url: browser.runtime.getURL("index.html") });
  };

  if (!currentEnv) return null; // Prevenzione errori di render iniziali

  return (
    <div className="window" style={{ height: "100%", boxSizing: "border-box" }}>
      {/* BARRA DEL TITOLO CON BOTTONE "ESPANDI" */}
      <div className="title-bar">
        <div className="title-bar-text">
          getOverHere
        </div>
        <div className="title-bar-controls">
          <button
            aria-label="Maximize"
            onClick={openFullPage}
            title={browser.i18n.getMessage("openInTabTitle")}
          ></button>
        </div>
      </div>

      <div className="window-body">
        {/* BARRA SUPERIORE: STATO GLOBALE E IMPORT/EXPORT */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "10px",
          }}
        >
          <fieldset style={{ margin: 0 }}>
            <legend>{browser.i18n.getMessage("masterState")}</legend>
            <div className="field-row">
              <input
                type="checkbox"
                id="enable-proxy"
                checked={isProxyActive}
                onChange={(e) => {
                  setIsProxyActive(e.target.checked);
                  syncNetwork(environments, e.target.checked);
                }}
              />
              <label
                htmlFor="enable-proxy"
                style={{
                  fontWeight: "bold",
                  color: isProxyActive ? "green" : "black",
                }}
              >
                {isProxyActive
                  ? browser.i18n.getMessage("proxyActive")
                  : browser.i18n.getMessage("proxyInactive")}
              </label>
            </div>
          </fieldset>

          <RulesManager rules={environments} onRulesUpdated={handleImport} />
        </div>

        {/* SEZIONE PROFILI (AMBIENTI) */}
        <fieldset
          style={{
            backgroundColor: currentEnv.isCurrent ? "#e6ffe6" : "transparent",
            marginBottom: "12px",
          }}
        >
          <legend>{browser.i18n.getMessage("envManager")}</legend>
          <div
            className="field-row"
            style={{ justifyContent: "space-between" }}
          >
            <div className="field-row">
              <label>{browser.i18n.getMessage("selectedProfile")}</label>
              <select
                value={currentEnvId}
                onChange={(e) => setCurrentEnvId(e.target.value)}
                style={{ width: "250px" }}
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.isCurrent ? browser.i18n.getMessage("inNetworkLabel") : ""}
                    {env.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={createEnvironment}>{browser.i18n.getMessage("btnNew")}</button>
              <button
                onClick={deleteCurrentEnvironment}
                style={{ color: "#d32f2f" }}
              >
                {browser.i18n.getMessage("btnDelete")}
              </button>
            </div>
          </div>

          <div style={{ marginTop: "10px" }}>
            <button
              disabled={currentEnv.isCurrent}
              onClick={setAsActiveNetworkProfile}
              style={{ fontWeight: currentEnv.isCurrent ? "normal" : "bold" }}
            >
              {currentEnv.isCurrent
                ? browser.i18n.getMessage("profileIsActive")
                : browser.i18n.getMessage("profileSetToActive")}
            </button>
          </div>
        </fieldset>

        {/* SEZIONE REGOLE (DEL PROFILO SELEZIONATO) */}
        <fieldset>
          <legend>
            {browser.i18n.getMessage("networkRules")} "{currentEnv.name}" ({currentEnv.rules.length})
          </legend>

          <div style={{ display: "flex", gap: "5px", marginBottom: "10px" }}>
            <button onClick={addEmptyRule} style={{ fontWeight: "bold" }}>
              {browser.i18n.getMessage("btnAddRule")}
            </button>
            <button onClick={() => toggleAllRules(true)}>{browser.i18n.getMessage("btnTurnOnAll")}</button>
            <button onClick={() => toggleAllRules(false)}>{browser.i18n.getMessage("btnTurnOffAll")}</button>
          </div>

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {currentEnv.rules.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "#666" }}>
                {browser.i18n.getMessage("noRulesMsg")}
              </p>
            ) : (
              currentEnv.rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "8px",
                    alignItems: "center",
                    background: rule.active ? "transparent" : "#d4d4d4",
                    padding: "4px",
                  }}
                >
                  <select
                    value={rule.type}
                    onChange={(e) =>
                      updateRule(rule.id, "type", e.target.value)
                    }
                    style={{ width: "90px" }}
                  >
                    <option value="redirect">{browser.i18n.getMessage("typeRedirect")}</option>
                    <option value="cors">{browser.i18n.getMessage("typeCors")}</option>
                  </select>

                  <div className="field-row" style={{ flexGrow: 1 }}>
                    <label style={{ width: "20px" }}>{browser.i18n.getMessage("labelFrom")}</label>
                    <input
                      type="text"
                      value={rule.sourceUrl}
                      placeholder={browser.i18n.getMessage("placeholderFrom")}
                      onChange={(e) =>
                        updateRule(rule.id, "sourceUrl", e.target.value)
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="field-row" style={{ flexGrow: 1 }}>
                    <label style={{ width: "20px" }}>{browser.i18n.getMessage("labelTo")}</label>
                    <input
                      type="text"
                      value={rule.targetUrl}
                      placeholder={
                        rule.type === "cors"
                          ? browser.i18n.getMessage("placeholderToCors")
                          : browser.i18n.getMessage("placeholderToRedirect")
                      }
                      onChange={(e) =>
                        updateRule(rule.id, "targetUrl", e.target.value)
                      }
                      disabled={rule.type === "cors"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="field-row" style={{ marginLeft: "5px" }}>
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) =>
                        updateRule(rule.id, "active", e.target.checked)
                      }
                      title={browser.i18n.getMessage("toggleRuleTitle")}
                    />
                  </div>

                  <button
                    onClick={() => deleteRule(rule.id)}
                    style={{ padding: "2px 8px", fontWeight: "bold" }}
                    title={browser.i18n.getMessage("deleteRuleTitle")}
                  >
                    X
                  </button>
                </div>
              ))
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
