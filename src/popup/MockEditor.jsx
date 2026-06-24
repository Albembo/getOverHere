import { useState } from "preact/hooks";
import browser from "webextension-polyfill";

const METHODS = ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const generateId = () => Math.random().toString(36).substr(2, 9);

const emptyMock = {
  id: generateId(),
  name: "",
  sourceUrl: "",
  method: "ANY",
  statusCode: 200,
  responseHeaders: [{ name: "Content-Type", value: "application/json" }],
  responseBody: "",
  active: true,
};

export function MockEditor({ mock, onSave, onCancel }) {
  const [form, setForm] = useState({ ...(mock || emptyMock), id: mock?.id || generateId() });

  const setField = (field, value) => setForm({ ...form, [field]: value });

  const setHeader = (index, field, value) => {
    const headers = [...form.responseHeaders];
    headers[index] = { ...headers[index], [field]: value };
    setField("responseHeaders", headers);
  };

  const addHeader = () => {
    setField("responseHeaders", [...form.responseHeaders, { name: "", value: "" }]);
  };

  const removeHeader = (index) => {
    const headers = form.responseHeaders.filter((_, i) => i !== index);
    if (headers.length === 0) headers.push({ name: "", value: "" });
    setField("responseHeaders", headers);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.sourceUrl.trim()) return;
    onSave({
      ...form,
      statusCode: parseInt(form.statusCode) || 200,
    });
  };

  const statusClass = (code) => {
    if (code >= 200 && code < 300) return "status-2xx";
    if (code >= 300 && code < 400) return "status-3xx";
    if (code >= 400 && code < 500) return "status-4xx";
    if (code >= 500) return "status-5xx";
    return "";
  };

  return (
    <div className="mock-editor fade-in">
      <div className="mock-editor-row">
        <label>{browser.i18n.getMessage("mockName")}</label>
        <input
          className="input-modern"
          type="text"
          value={form.name}
          placeholder="Mock API Users"
          onChange={(e) => setField("name", e.target.value)}
        />
      </div>

      <div className="mock-editor-row">
        <label>{browser.i18n.getMessage("mockUrlPattern")}</label>
        <input
          className="input-modern"
          type="text"
          value={form.sourceUrl}
          placeholder={browser.i18n.getMessage("mockPlaceholderUrl")}
          onChange={(e) => setField("sourceUrl", e.target.value)}
        />
      </div>

      <div className="flex-row-wrap">
        <div className="mock-editor-row" style={{ flex: 1 }}>
          <label>{browser.i18n.getMessage("mockMethod")}</label>
          <select
            className="select-modern"
            value={form.method}
            onChange={(e) => setField("method", e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mock-editor-row" style={{ flex: 1 }}>
          <label>{browser.i18n.getMessage("mockStatusCode")}</label>
          <input
            className="input-modern"
            type="number"
            min="100"
            max="599"
            value={form.statusCode}
            onChange={(e) => setField("statusCode", e.target.value)}
            style={{ width: "80px" }}
          />
          <span className={`status-badge ${statusClass(form.statusCode)}`}>
            {form.statusCode}
          </span>
        </div>
      </div>

      <div>
        <label className="inline-label">{browser.i18n.getMessage("mockResponseHeaders")}</label>
        <div className="header-list mt-6">
          {form.responseHeaders.map((header, i) => (
            <div key={i} className="header-row">
              <input
                className="input-modern"
                type="text"
                value={header.name}
                placeholder={browser.i18n.getMessage("headerName")}
                onChange={(e) => setHeader(i, "name", e.target.value)}
              />
              <span style={{ color: "var(--text-muted)" }}>:</span>
              <input
                className="input-modern"
                type="text"
                value={header.value}
                placeholder={browser.i18n.getMessage("headerValue")}
                onChange={(e) => setHeader(i, "value", e.target.value)}
              />
              <button
                className="btn btn-sm btn-danger"
                onClick={() => removeHeader(i)}
                title={browser.i18n.getMessage("removeHeader")}
              >
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={addHeader}>
            {browser.i18n.getMessage("addHeader")}
          </button>
        </div>
      </div>

      <div>
        <label className="inline-label">{browser.i18n.getMessage("mockResponseBody")}</label>
        <textarea
          className="textarea-modern"
          value={form.responseBody}
          placeholder={browser.i18n.getMessage("mockPlaceholderBody")}
          onChange={(e) => setField("responseBody", e.target.value)}
          style={{ width: "100%", marginTop: "6px", minHeight: "120px" }}
        />
      </div>

      <div className="mock-editor-actions">
        <button className="btn" onClick={onCancel}>
          {browser.i18n.getMessage("btnCancel")}
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          {browser.i18n.getMessage("btnSave")}
        </button>
      </div>
    </div>
  );
}
