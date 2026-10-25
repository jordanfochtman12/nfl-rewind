import { after, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: "custom",
  server: { middlewareMode: true },
});
const { AppErrorBoundary } = await vite.ssrLoadModule("/src/components/AppErrorBoundary.tsx");

after(async () => vite.close());

test("a render failure becomes a branded, save-safe reload screen", () => {
  const failureState = AppErrorBoundary.getDerivedStateFromError(new Error("simulated lazy screen failure"));
  assert.deepEqual(failureState, { failed: true });

  const boundary = new AppErrorBoundary({ children: null });
  boundary.state = failureState;
  const html = renderToStaticMarkup(boundary.render());

  assert.match(html, /role="alert"/);
  assert.match(html, /This screen didn’t load/);
  assert.match(html, /Reload game/);
  assert.match(html, /Your dynasty save is stored separately and is not cleared by reloading/);
});
