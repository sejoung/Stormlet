/**
 * The layer map of ADR 0001, shared by .dependency-cruiser.cjs and tests/architecture.
 * Dependency direction: domain ← application / engine / adapters ← components ← app.
 */

/** Each layer may import only these layers inside `src`. */
const LAYERS = {
  domain: ['domain'],
  application: ['application', 'domain'],
  engine: ['engine', 'domain'],
  adapters: ['adapters', 'domain'],
  components: ['components', 'application', 'domain', 'engine'],
  app: ['app', 'components', 'application', 'domain', 'engine', 'adapters'],
};

/** npm packages a layer may use; a layer missing here is pure TypeScript. */
const PACKAGES = {
  components: ['react', 'react-dom'],
  app: ['react', 'react-dom'],
};

module.exports = { LAYERS, PACKAGES };
