import browser from "webextension-polyfill";

// 🧠 TRADUTTORE WILDCARD
const parseWildcards = (source, target) => {
  if (!source) return { regexFilter: ".*", regexSubstitution: target };

  // Escape dei caratteri speciali tranne l'asterisco
  const escapedSource = source.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

  // Trasforma l'asterisco in un gruppo di cattura
  const regexFilter = "^" + escapedSource.replace(/\*/g, "(.*)") + "$";

  // Mappa gli asterischi target nei riferimenti regex (\1, \2...)
  let regexSubstitution = target || "";
  let matchCount = 1;
  while (regexSubstitution.includes("*")) {
    regexSubstitution = regexSubstitution.replace("*", `\\${matchCount}`);
    matchCount++;
  }

  return { regexFilter, regexSubstitution };
};

browser.runtime.onMessage.addListener(async (request) => {
  if (request.action === "UPDATE_RULES") {
    try {
      const existingRules =
        await browser.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map((rule) => rule.id);

      const newRules = request.rules
        .filter((r) => r.active)
        .map((rule, index) => {
          const id = index + 1;

          if (rule.type === "cors") {
            console.log(`[CORS] Registrata: ${rule.sourceUrl}`);
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

          if (rule.type === "redirect") {
            const { regexFilter, regexSubstitution } = parseWildcards(
              rule.sourceUrl,
              rule.targetUrl,
            );
            console.log(
              `[REDIRECT] Tradotto: ${rule.sourceUrl} ---> Regex: ${regexFilter} | Target: ${regexSubstitution}`,
            );

            return {
              id,
              priority: 2,
              action: { type: "redirect", redirect: { regexSubstitution } },
              condition: {
                regexFilter,
                resourceTypes: ["script", "xmlhttprequest", "sub_frame"],
              },
            };
          }
        });

      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: newRules,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});
