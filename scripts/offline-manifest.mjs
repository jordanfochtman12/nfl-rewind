const PRECACHE_EXTENSIONS = /\.(?:js|css|woff2)$/;
const HISTORICAL_BOX_CHUNK = /(^|\/)(?:19|20)\d\d-[\w-]+\.js$/;

function addStaticDependencies(fileName, bundle, files, visited) {
  if (visited.has(fileName)) return;
  visited.add(fileName);
  const output = bundle[fileName];
  if (!output || output.type !== "chunk") return;

  files.add(fileName);
  for (const imported of output.imports) addStaticDependencies(imported, bundle, files, visited);
  for (const asset of output.viteMetadata?.importedCss ?? []) files.add(asset);
  for (const asset of output.viteMetadata?.importedAssets ?? []) files.add(asset);
}

/** Build the service-worker manifest, separating required app-shell assets from lazy assets. */
export function offlineManifest(bundle) {
  const files = Object.keys(bundle)
    .filter((file) => PRECACHE_EXTENSIONS.test(file) && !HISTORICAL_BOX_CHUNK.test(file))
    .sort();
  const precache = new Set();
  const visited = new Set();

  for (const [file, output] of Object.entries(bundle)) {
    if (output.type === "chunk" && output.isEntry) addStaticDependencies(file, bundle, precache, visited);
  }

  // Include emitted CSS/font assets referenced by the static shell dependency graph.
  for (const file of [...precache]) {
    const asset = bundle[file];
    for (const dependency of asset?.viteMetadata?.importedCss ?? []) precache.add(dependency);
    for (const dependency of asset?.viteMetadata?.importedAssets ?? []) precache.add(dependency);
  }

  const required = [...precache].filter((file) => files.includes(file)).sort();
  const sizes = Object.fromEntries(files.map((file) => {
    const output = bundle[file];
    const content = output?.type === "chunk" ? output.code : output?.source;
    const bytes = typeof content === "string"
      ? Buffer.byteLength(content)
      : content?.byteLength ?? 0;
    return [file, bytes];
  }));
  return {
    files,
    precache: required,
    sizes,
    totalBytes: files.reduce((sum, file) => sum + sizes[file], 0),
    precacheBytes: required.reduce((sum, file) => sum + sizes[file], 0),
  };
}
