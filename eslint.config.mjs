import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Module boundaries — see features/README.md. Every folder in features/ is a
 * product, picked up here automatically.
 *
 * Three rules share the work: `import/no-restricted-paths` resolves every import
 * (`@/` aliases, relative paths, `import()`, `require()`) to a file and checks
 * the layers; `no-restricted-imports` adds the finer rule for a product's pure
 * top-level files, which needs to tell type imports from value imports; and
 * `no-restricted-syntax` bans the import forms neither of them can read.
 */
const PRODUCTS = readdirSync(new URL("./features", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const SOURCE = "{ts,tsx,js,jsx,mjs}";

const MESSAGES = {
  otherProduct: "A product never imports another product. Wire them together in lib/diligence (pipeline) or components/features/analyze (UI).",
  appUi: "Products don't import app/, and from components/ only components/report and components/ui.",
  kernel: "lib/core is the kernel: it imports only itself, lib/llm and lib/config.",
  primitives: "Shared primitives know no product: they import only each other, lib/core and lib/sources. Pass anything else in as props.",
  pure: "A product's top-level files import values only from lib/core and from each other (types from elsewhere are fine). Put code that needs more in stage.ts or ui/.",
  uiServer: "A product's UI runs in the browser: it can't import its own server code (stage.ts, pdf/).",
  serverUi: "Server code (stage.ts, pdf/) doesn't import UI.",
  dotSegments: "Write @/ paths without ./ or ../ in them, so the boundary rules can read them.",
};

// ── no-restricted-imports patterns, matched against the specifier as written ──

const OTHER_PRODUCT = (product) => ({ regex: `^@/features/(?!${product}/)`, message: MESSAGES.otherProduct });
const APP_UI = { regex: "^@/(?:app/|components/(?!(?:report|ui)/))", message: MESSAGES.appUi };
const DOT_SEGMENTS = { regex: "^@/(?:.*/)?\\.\\.?(?:/|$)", message: MESSAGES.dotSegments };
/**
 * Pure files (types, form, state, parse, prompts…) run anywhere, so their values
 * come only from the kernel and their own siblings. Type imports are fine —
 * except from where the patterns above forbid even those: a type import that
 * matches a pattern with `allowTypeImports` skips every other pattern, so this
 * one leaves those paths out.
 */
const KERNEL_ONLY = (product) => ({
  regex:
    `^@/(?!lib/core/|app/|components/(?!(?:report|ui)/)|features/(?!${product}/)` +
    `|features/${product}/(?!stage(?:\\.\\w+)?$)[^/]+$|(?:.*/)?\\.\\.?(?:/|$))`,
  allowTypeImports: true,
  message: MESSAGES.pure,
});
/** The same, for relative paths: out of the product folder, or into a subfolder or stage.ts. */
const PURE_RELATIVE = {
  regex: "^(?:\\.\\.$|\\.\\./|\\./(?:\\./)*(?!\\./)[^/]+/|\\./(?:\\./)*stage(?:\\.\\w+)?$)",
  allowTypeImports: true,
  message: MESSAGES.pure,
};
/** And for packages, Node's built-ins included. */
const PURE_PACKAGES = { regex: "^(?![./]|@/)", allowTypeImports: true, message: MESSAGES.pure };

// ── import/no-restricted-paths zones, matched against the resolved file ──

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const at = (path) => `./${path}`;
const LAYERS = [
  ...PRODUCTS.map((product) => ({
    target: at(`features/${product}`),
    from: at("features"),
    except: [`./${product}`],
    message: MESSAGES.otherProduct,
  })),
  { target: at("features"), from: at("app"), message: MESSAGES.appUi },
  { target: at("features"), from: at("components"), except: ["./report", "./ui"], message: MESSAGES.appUi },
  {
    target: at(`features/*/ui/**/*.${SOURCE}`),
    from: [at("features/*/stage.*"), at("features/*/pdf/**")],
    message: MESSAGES.uiServer,
  },
  {
    target: [at(`features/*/stage.${SOURCE}`), at(`features/*/pdf/**/*.${SOURCE}`)],
    from: at("features/*/ui/**"),
    message: MESSAGES.serverUi,
  },
  {
    target: [at(`features/*/stage.${SOURCE}`), at(`features/*/pdf/**/*.${SOURCE}`)],
    from: at("components"),
    message: MESSAGES.serverUi,
  },
  // The two below are allowlists: everything in the repo but what's named
  // (packages resolve into node_modules, so that's named too).
  {
    target: at("lib/core"),
    from: ".",
    except: ["./lib/core", "./lib/llm", "./lib/config.ts", "./node_modules"],
    message: MESSAGES.kernel,
  },
  {
    target: [at("components/report"), at("components/ui")],
    from: ".",
    except: ["./components/report", "./components/ui", "./lib/core", "./lib/sources.ts", "./node_modules"],
    message: MESSAGES.primitives,
  },
];

// ── no-restricted-syntax: import forms the two rules above can't read ──

const UNREADABLE_IMPORTS = [
  {
    selector: "ImportExpression[source.type!='Literal']",
    message: "Give import() a plain string, so the boundary rules can check it.",
  },
  {
    selector: "TSImportType",
    message: "Use `import type` rather than `import(\"…\").Name`, so the boundary rules can check it.",
  },
];
const LAZY_IMPORT = {
  selector: "ImportExpression",
  message: "A product's top-level files don't load code lazily. Do that in stage.ts or ui/.",
};

const boundaries = (files, patterns, syntax = UNREADABLE_IMPORTS) => ({
  files,
  rules: {
    "@typescript-eslint/no-restricted-imports": ["error", { patterns }],
    "no-restricted-syntax": ["error", ...syntax],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [`**/*.${SOURCE}`],
    rules: {
      "import/no-restricted-paths": ["error", { basePath: ROOT, zones: LAYERS }],
    },
  },
  // A later block replaces an earlier one's options for the same rule, so each
  // file set below lists everything it's held to.
  ...PRODUCTS.flatMap((product) => [
    boundaries([`features/${product}/**/*.${SOURCE}`], [OTHER_PRODUCT(product), APP_UI, DOT_SEGMENTS]),
    {
      ...boundaries(
        [`features/${product}/*.${SOURCE}`],
        [OTHER_PRODUCT(product), APP_UI, DOT_SEGMENTS, KERNEL_ONLY(product), PURE_RELATIVE, PURE_PACKAGES],
        [...UNREADABLE_IMPORTS, LAZY_IMPORT],
      ),
      ignores: [`features/${product}/stage.${SOURCE}`],
    },
  ]),
  boundaries(
    [`lib/core/**/*.${SOURCE}`],
    [{ regex: "^@/(?!lib/(?:core|llm)(?:/|$)|lib/config$)", message: MESSAGES.kernel }, DOT_SEGMENTS],
  ),
  boundaries(
    [`components/report/**/*.${SOURCE}`, `components/ui/**/*.${SOURCE}`],
    [{ regex: "^@/(?!components/(?:report|ui)/|lib/core/|lib/sources$)", message: MESSAGES.primitives }, DOT_SEGMENTS],
  ),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
