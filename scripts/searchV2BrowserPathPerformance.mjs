import assert from "node:assert/strict";

const baseUrl =
  process.argv.find((value) => value.startsWith("--base-url="))?.slice(11) ||
  "http://localhost:3001";
const query =
  process.argv.find((value) => value.startsWith("--query="))?.slice(8) ||
  "SAP FICO Malaysia implementation";
const targetId = process.argv
  .find((value) => value.startsWith("--target-id="))
  ?.slice(12);
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const target =
  targets.find((item) => item.id === targetId) ||
  targets.find(
    (item) =>
      item.type === "page" &&
      item.url.startsWith(baseUrl) &&
      /Candidate Search V2/i.test(item.title),
  ) ||
  targets.find(
    (item) =>
      item.type === "page" &&
      item.url.startsWith(baseUrl) &&
      !item.url.includes("/auth/login"),
  ) ||
  targets.find((item) => item.type === "page" && item.url === "about:blank");
assert(target, "No authorized Chrome debugging target is available.");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const requests = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id);
    pending.delete(message.id);
    message.error
      ? item.reject(new Error(message.error.message))
      : item.resolve(message.result);
  }
  if (
    message.method === "Network.requestWillBeSent" &&
    message.params.request.url.endsWith("/api/recruiter/search-v2") &&
    message.params.request.method === "POST"
  )
    requests.set(message.params.requestId, { started: performance.now() });
  if (
    message.method === "Network.responseReceived" &&
    requests.has(message.params.requestId)
  ) {
    const item = requests.get(message.params.requestId);
    item.response = performance.now();
    item.status = message.params.response.status;
    item.serverTiming =
      message.params.response.headers["server-timing"] ||
      message.params.response.headers["Server-Timing"] ||
      "";
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 10000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (expression, label, timeout = 30000) => {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
};
try {
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: `${baseUrl}/recruiter/talent-search/v2` });
  await waitFor(
    `Boolean(document.querySelector('textarea, input[placeholder*="Describe"]'))`,
    "Search input",
    60000,
  );
  const readinessEntries = await evaluate(
    `performance.getEntriesByType('resource').filter(x=>x.name.endsWith('/api/recruiter/search-v2')).map(x=>({name:x.name,duration:x.duration}))`,
  );
  const filled = await evaluate(
    `(()=>{const el=document.querySelector('textarea, input[placeholder*="Describe"]');if(!el)return false;const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,${JSON.stringify(query)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`,
  );
  assert(filled);
  const reviewClickAt = performance.now();
  const understood = await evaluate(
    `(()=>{const el=[...document.querySelectorAll('button')].find(x=>/Understand|review requirements/i.test(x.textContent));if(!el)return false;el.click();return true})()`,
  );
  assert(understood);
  await waitFor(
    `[...document.querySelectorAll('button')].some(x=>/Commit Search/i.test(x.textContent)&&!x.disabled)`,
    "Commit Search",
  );
  const reviewReadyAt = performance.now();
  const clickAt = performance.now();
  const clicked = await evaluate(
    `(()=>{const el=[...document.querySelectorAll('button')].find(x=>/Commit Search/i.test(x.textContent));if(!el)return false;el.click();return true})()`,
  );
  assert(clicked);
  await waitFor(
    `!document.body.innerText.includes('Searching candidates...')&&Boolean(document.querySelector('#search-results'))&&(/Showing(?: top)? \d+ of \d+ (?:eligible|matching) candidates/.test(document.body.innerText)||/\d+ candidates found/.test(document.body.innerText))`,
    "painted Search results",
    30000,
  );
  await evaluate(
    `new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))`,
  );
  const paintedAt = performance.now();
  const request = [...requests.values()].at(-1) || {};
  assert.equal(request.status, 200);
  assert(
    paintedAt - clickAt < 1500,
    `Authenticated-style click-to-paint ${(paintedAt - clickAt).toFixed(1)}ms exceeds 1500ms`,
  );
  console.log(
    JSON.stringify({
      suite: "searchV2BrowserPathPerformance",
      baseUrl,
      query,
      readinessEntries,
      reviewToReadyMs: +(reviewReadyAt - reviewClickAt).toFixed(1),
      clickToPaintMs: +(paintedAt - clickAt).toFixed(1),
      networkStartAfterClickMs: +(
        (request.started || clickAt) - clickAt
      ).toFixed(1),
      networkMs: +(
        (request.response || paintedAt) - (request.started || clickAt)
      ).toFixed(1),
      serverTiming: request.serverTiming || "",
      resultText: await evaluate(
        `document.querySelector('#search-results h2')?.textContent||[...document.querySelectorAll('h2')].find(x=>/candidates found/.test(x.textContent))?.textContent||''`,
      ),
    }),
  );
} finally {
  ws.close();
}
