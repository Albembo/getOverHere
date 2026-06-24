import { useState, useEffect } from "preact/hooks";
import browser from "webextension-polyfill";
import { RulesManager } from "./RulesManager.jsx";
import { MockManager } from "./MockManager.jsx";
import "./popup.css";

const generateId = () => Math.random().toString(36).substr(2, 9);

export function App() {
  const [environments, setEnvironments] = useState([]);
  const [currentEnvId, setCurrentEnvId] = useState(null);
  const [isProxyActive, setIsProxyActive] = useState(false);
  const [activeTab, setActiveTab] = useState("rules");
  const [mocks, setMocks] = useState([]);

  useEffect(() => {
    browser.storage.local.get(["environments", "proxyStatus", "mocks"]).then((res) => {
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
      setMocks(res.mocks || []);
      setIsProxyActive(res.proxyStatus !== undefined ? res.proxyStatus : false);

      const activeEnv = loadedEnvs.find((env) => env.isCurrent) || loadedEnvs[0];
      setCurrentEnvId(activeEnv.id);
    });
  }, []);

  const syncNetwork = async (envs, proxyState) => {
    await browser.storage.local.set({
      environments: envs,
      proxyStatus: proxyState,
    });

    const activeEnv = envs.find((e) => e.isCurrent);
    const rulesToApply = proxyState && activeEnv ? activeEnv.rules : [];

    await browser.runtime.sendMessage({
      action: "UPDATE_RULES",
      rules: rulesToApply,
    });
  };

  const syncMocks = async (newMocks) => {
    setMocks(newMocks);
    await browser.storage.local.set({ mocks: newMocks });
    await browser.runtime.sendMessage({
      action: "UPDATE_MOCKS",
      mocks: newMocks,
    });
  };

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
    setCurrentEnvId(newEnv.id);
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
    setCurrentEnvId(updated[0].id);

    if (environments.find((e) => e.id === currentEnvId)?.isCurrent) {
      updated[0].isCurrent = true;
    }

    syncNetwork(updated, isProxyActive);
  };

  const setAsActiveNetworkProfile = () => {
    const updated = environments.map((env) => ({
      ...env,
      isCurrent: env.id === currentEnvId,
    }));
    setEnvironments(updated);
    syncNetwork(updated, isProxyActive);
  };

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

  const handleImport = (importedEnvs) => {
    try {
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
    browser.tabs.create({ url: browser.runtime.getURL("index.html") });
  };

  if (!currentEnv) return null;

  return (
    <div className="app-window">
      <div className="title-bar-modern">
        <span>getOverHere</span>
        <div className="title-controls">
          <button
            onClick={openFullPage}
            title={browser.i18n.getMessage("openInTabTitle")}
          >
            ⛶
          </button>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab ${activeTab === "rules" ? "active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          🌐 {browser.i18n.getMessage("tabNetworkRules")}
        </button>
        <button
          className={`tab ${activeTab === "mocks" ? "active" : ""}`}
          onClick={() => setActiveTab("mocks")}
        >
          🧪 {browser.i18n.getMessage("tabResponseMocks")}
        </button>
      </div>

      <div className="window-body-modern">
        {activeTab === "rules" ? (
          <>
            {/* HEADER: MASTER TOGGLE + IMPORT/EXPORT */}
            <div className="flex-between">
              <fieldset className="modern-fieldset" style={{ flex: 1, marginRight: "10px" }}>
                <legend>{browser.i18n.getMessage("masterState")}</legend>
                <div className="master-state">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isProxyActive}
                      onChange={(e) => {
                        setIsProxyActive(e.target.checked);
                        syncNetwork(environments, e.target.checked);
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className={`master-label ${isProxyActive ? "active" : "inactive"}`}>
                    {isProxyActive
                      ? browser.i18n.getMessage("proxyActive")
                      : browser.i18n.getMessage("proxyInactive")}
                  </span>
                </div>
              </fieldset>

              <RulesManager rules={environments} onRulesUpdated={handleImport} />
            </div>

            {/* ENVIRONMENT MANAGER */}
            <fieldset
              className="modern-fieldset"
              style={{
                background: currentEnv.isCurrent ? "var(--accent-lighter)" : "var(--surface)",
                borderColor: currentEnv.isCurrent ? "var(--accent-border)" : "var(--border)",
              }}
            >
              <legend>{browser.i18n.getMessage("envManager")}</legend>

              <div className="flex-between">
                <div className="flex-row">
                  <label className="inline-label">{browser.i18n.getMessage("selectedProfile")}</label>
                  <select
                    className="select-modern"
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

                <div className="flex-row">
                  <button className="btn btn-primary" onClick={createEnvironment}>
                    {browser.i18n.getMessage("btnNew")}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={deleteCurrentEnvironment}
                  >
                    {browser.i18n.getMessage("btnDelete")}
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <button
                  className={`btn ${currentEnv.isCurrent ? "" : "btn-success"}`}
                  disabled={currentEnv.isCurrent}
                  onClick={setAsActiveNetworkProfile}
                >
                  {currentEnv.isCurrent
                    ? browser.i18n.getMessage("profileIsActive")
                    : browser.i18n.getMessage("profileSetToActive")}
                </button>
              </div>
            </fieldset>

            {/* NETWORK RULES */}
            <fieldset className="modern-fieldset" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <legend>
                {browser.i18n.getMessage("networkRules")} "{currentEnv.name}" ({currentEnv.rules.length})
              </legend>

              <div className="flex-row mb-6">
                <button className="btn btn-primary" onClick={addEmptyRule}>
                  {browser.i18n.getMessage("btnAddRule")}
                </button>
                <button className="btn btn-sm btn-success" onClick={() => toggleAllRules(true)}>
                  {browser.i18n.getMessage("btnTurnOnAll")}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => toggleAllRules(false)}>
                  {browser.i18n.getMessage("btnTurnOffAll")}
                </button>
              </div>

              <div className="scroll-area">
                {currentEnv.rules.length === 0 ? (
                  <div className="empty-state">
                    {browser.i18n.getMessage("noRulesMsg")}
                  </div>
                ) : (
                  currentEnv.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rule-row ${rule.active ? "" : "inactive"} fade-in`}
                    >
                      <select
                        className="select-modern"
                        value={rule.type}
                        onChange={(e) => updateRule(rule.id, "type", e.target.value)}
                        style={{ width: "90px" }}
                      >
                        <option value="redirect">{browser.i18n.getMessage("typeRedirect")}</option>
                        <option value="cors">{browser.i18n.getMessage("typeCors")}</option>
                      </select>

                      <div className="flex-row flex-1">
                        <label className="inline-label" style={{ width: "auto", minWidth: "20px" }}>From:</label>
                        <input
                          className="input-modern"
                          type="text"
                          value={rule.sourceUrl}
                          placeholder={browser.i18n.getMessage("placeholderFrom")}
                          onChange={(e) => updateRule(rule.id, "sourceUrl", e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </div>

                      <div className="flex-row flex-1">
                        <label className="inline-label" style={{ width: "auto", minWidth: "20px" }}>To:</label>
                        <input
                          className="input-modern"
                          type="text"
                          value={rule.targetUrl}
                          placeholder={
                            rule.type === "cors"
                              ? browser.i18n.getMessage("placeholderToCors")
                              : browser.i18n.getMessage("placeholderToRedirect")
                          }
                          onChange={(e) => updateRule(rule.id, "targetUrl", e.target.value)}
                          disabled={rule.type === "cors"}
                          style={{ flex: 1 }}
                        />
                      </div>

                      <label className="toggle-switch" title={browser.i18n.getMessage("toggleRuleTitle")}>
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={(e) => updateRule(rule.id, "active", e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>

                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteRule(rule.id)}
                        title={browser.i18n.getMessage("deleteRuleTitle")}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </fieldset>
          </>
        ) : (
          <MockManager
            mocks={mocks}
            onUpdate={syncMocks}
          />
        )}
      </div>
    </div>
  );
}
