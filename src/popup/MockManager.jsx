import { useState } from "preact/hooks";
import browser from "webextension-polyfill";
import { MockEditor } from "./MockEditor.jsx";

const methodClass = (method) => {
  const map = {
    ANY: "method-any",
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    PATCH: "method-patch",
    DELETE: "method-delete",
    HEAD: "method-head",
    OPTIONS: "method-options",
  };
  return map[method] || "method-any";
};

const statusClass = (code) => {
  if (code >= 200 && code < 300) return "status-2xx";
  if (code >= 300 && code < 400) return "status-3xx";
  if (code >= 400 && code < 500) return "status-4xx";
  if (code >= 500) return "status-5xx";
  return "";
};

export function MockManager({ mocks, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const addMock = (mock) => {
    onUpdate([...mocks, mock]);
    setIsAdding(false);
  };

  const updateMock = (updated) => {
    onUpdate(mocks.map((m) => (m.id === updated.id ? updated : m)));
    setEditingId(null);
  };

  const deleteMock = (id) => {
    if (!window.confirm(browser.i18n.getMessage("mockDeleteConfirm"))) return;
    onUpdate(mocks.filter((m) => m.id !== id));
  };

  const toggleActive = (id, active) => {
    onUpdate(mocks.map((m) => (m.id === id ? { ...m, active } : m)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div className="flex-row">
        <button
          className="btn btn-primary"
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          disabled={isAdding}
        >
          {browser.i18n.getMessage("btnAddMock")}
        </button>
      </div>

      <div className="scroll-area">
        {isAdding && (
          <MockEditor
            onSave={addMock}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {mocks.length === 0 && !isAdding ? (
          <div className="empty-state">
            {browser.i18n.getMessage("noMocksMsg")}
          </div>
        ) : (
          mocks.map((mock) => (
            editingId === mock.id ? (
              <MockEditor
                key={mock.id}
                mock={mock}
                onSave={updateMock}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={mock.id}
                className={`mock-card active-${mock.active} fade-in`}
              >
                <div className="mock-card-header">
                  <label className="toggle-switch" title={browser.i18n.getMessage("toggleMockTitle")}>
                    <input
                      type="checkbox"
                      checked={mock.active}
                      onChange={(e) => toggleActive(mock.id, e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>

                  <span className={`method-badge ${methodClass(mock.method)}`}>
                    {mock.method}
                  </span>

                  <span className="mock-name">{mock.name || "Untitled"}</span>

                  <span className={`status-badge ${statusClass(mock.statusCode)}`}>
                    {mock.statusCode}
                  </span>

                  <div className="mock-card-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => { setEditingId(mock.id); setIsAdding(false); }}
                    >
                      {browser.i18n.getMessage("btnEdit")}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteMock(mock.id)}
                    >
                      {browser.i18n.getMessage("btnDelete")}
                    </button>
                  </div>
                </div>

                <div className="mock-card-body">
                  <span className="mock-url">{mock.sourceUrl}</span>
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}
