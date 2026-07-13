import browser from "webextension-polyfill";

const MOCK_ID_OFFSET = 1000;

const parseWildcards = (source, target) => {
  if (!source) return { regexFilter: ".*", regexSubstitution: target };

  const escapedSource = source.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexFilter = "^" + escapedSource.replace(/\*/g, "(.*)") + "$";

  let regexSubstitution = target || "";
  let matchCount = 1;
  while (regexSubstitution.includes("*")) {
    regexSubstitution = regexSubstitution.replace("*", `\\${matchCount}`);
    matchCount++;
  }

  return { regexFilter, regexSubstitution };
};

const buildDataUri = (mock) => {
  const contentType = (mock.responseHeaders || [])
    .find((h) => h.name.toLowerCase() === "content-type")?.value || "text/plain";
  const encoded = btoa(unescape(encodeURIComponent(mock.responseBody || "")));
  return `data:${contentType};base64,${encoded}`;
};

browser.runtime.onMessage.addListener(async (request) => {
  if (request.action === "UPDATE_RULES") {
    try {
      const existingRules =
        await browser.declarativeNetRequest.getDynamicRules();
      const networkRuleIds = existingRules
        .filter((r) => r.id < MOCK_ID_OFFSET)
        .map((r) => r.id);

      const newRules = request.rules
        .filter((r) => r.active)
        .filter((r) => r.type === "cors" || r.type === "redirect")
        .map((rule, index) => {
          const id = index + 1;

          if (rule.type === "cors") {
            console.log(`[CORS] ${rule.sourceUrl}`);
            return {
              id,
              priority: 1,
              action: {
                type: "modifyHeaders",
                responseHeaders: [
                  {
                    header: "Access-Control-Allow-Origin",
                    operation: "set",
                    value: "*",
                  },
                ],
              },
              condition: {
                urlFilter: rule.sourceUrl,
                resourceTypes: ["xmlhttprequest", "sub_frame", "script"],
              },
            };
          }

          const { regexFilter, regexSubstitution } = parseWildcards(
            rule.sourceUrl,
            rule.targetUrl,
          );
          console.log(`[REDIRECT] ${rule.sourceUrl} -> ${regexFilter} | ${regexSubstitution}`);

          return {
            id,
            priority: 2,
            action: { type: "redirect", redirect: { regexSubstitution } },
            condition: {
              regexFilter,
              resourceTypes: ["script", "xmlhttprequest", "sub_frame"],
            },
          };
        });

      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: networkRuleIds,
        addRules: newRules,
      });

      return { success: true };
    } catch (error) {
      console.error("[UPDATE_RULES]", error);
      return { success: false, error: error.message };
    }
  }

  if (request.action === "UPDATE_MOCKS") {
    try {
      const existingRules =
        await browser.declarativeNetRequest.getDynamicRules();
      const mockRuleIds = existingRules
        .filter((r) => r.id >= MOCK_ID_OFFSET)
        .map((r) => r.id);

      const newMockRules = (request.mocks || [])
        .filter((m) => m.active && m.sourceUrl)
        .map((mock, index) => ({
          id: MOCK_ID_OFFSET + index,
          priority: 3,
          action: {
            type: "redirect",
            redirect: { url: buildDataUri(mock) },
          },
          condition: {
            urlFilter: mock.sourceUrl,
            resourceTypes: ["xmlhttprequest", "sub_frame"],
          },
        }));

      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: mockRuleIds,
        addRules: newMockRules,
      });

      return { success: true };
    } catch (error) {
      console.error("[UPDATE_MOCKS]", error);
      return { success: false, error: error.message };
    }
  }
});
