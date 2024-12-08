/**
 * Use a Web Worker to initialize and run pyodide code
 * without blocking the main thread.
 */
import { JSONValue } from "@holdenmatt/ts-utils";
import { expose } from "comlink";
import { loadPyodide, PyodideInterface, version } from "pyodide";
import { DEBUG } from "./config";

const indexURL = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;

declare global {
  interface Window {
    pyodide: PyodideInterface;
  }
}

//
// Initialize
//
let _pyodideReady: Promise<void> | null = null;
// NEW: Added output state variable
let _output: ((text: string) => void) | null = null;

/**
 * Initialize pyodide and set a singleton promise to await it being ready.
 * This should only be called once.
 */
function initialize(
  /**
   * Packages to load via micropip, including official pyodide packages or Python wheels.
   *
   * See:
   * https://pyodide.org/en/stable/usage/loading-packages.html#loading-packages
   */
  packages?: string[],
  // NEW: Added options parameter
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
) {
  if (_pyodideReady !== null) {
    throw new Error("pyodide was already initialized");
  }
  // NEW: Pass options to _loadPyodide
  _pyodideReady = _loadPyodide(packages, options);
  return _pyodideReady;
}

/**
 * Load pyodide with some given packages.
 *
 * Loads all packages with micropip, as recommended here:
 * https://pyodide.org/en/stable/usage/loading-packages.html#how-to-chose-between-micropip-install-and-pyodide-loadpackage
 */
async function _loadPyodide(
  packages: string[] = [],
  // NEW: Added options parameter
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
): Promise<void> {
  self.pyodide = await loadPyodide({
    indexURL,
    // NEW: Modified stdout to use options and _output
    stdout: (msg: string) => {
      if (options?.stdout) {
        options.stdout(msg);
      }
      if (_output) {
        _output(msg);
      }
      DEBUG && console.log("loadPyodide stdout: ", msg);
    },
    // NEW: Modified stderr to use options and _output
    stderr: (msg: string) => {
      if (options?.stderr) {
        options.stderr(msg);
      }
      if (_output) {
        _output(msg);
      }
      DEBUG && console.log("loadPyodide stderr: ", msg);
    },
  });

  if (packages.length > 0) {
    await self.pyodide.loadPackage(["micropip"]);
    const micropip = self.pyodide.pyimport("micropip");
    await micropip.install(packages);
  }
}

//
// Run python code
//
/**
 * Execute a Python code string.
 *
 * Optionally, pass in global vars to the Python execution namespace.
 *
 * Returns a promise which resolves when execution completes.
 * If the last statement in the Python code is an expression
 * (and the code doesn't end with a semicolon), the returned promise
 * will resolve to the value of this expression.
 */
async function runPython(
  code: string,
  globals?: Record<string, JSONValue>
): Promise<unknown> {
  await _pyodideReady;
  const options = {
    globals: globals ? self.pyodide.toPy(globals) : undefined,
  };
  // NEW: Added try/catch block for error handling
  try {
    return await self.pyodide.runPythonAsync(code, options);
  } catch (err) {
    if (err instanceof Error) {
      const lines = err.message.split("\n");
      const cleanedLines = lines.filter((line) => !line.includes('File "<exec>"'));
      const errorMessage = cleanedLines.join("\n");
      if (_output) {
        _output(errorMessage);
      }
      throw new Error(errorMessage);
    }
    throw err;
  }
}

// NEW: Added setOutput function
function setOutput(callback: ((text: string) => void) | null): void {
  _output = callback;
}

export interface PyodideRunner {
  initialize: (
    packages?: string[],
    // NEW: Added options to interface
    options?: {
      stdout?: (text: string) => void;
      stderr?: (text: string) => void;
    }
  ) => Promise<void>;
  runPython: (code: string, globals?: Record<string, JSONValue>) => Promise<unknown>;
  // NEW: Added setOutput to interface
  setOutput: (callback: ((text: string) => void) | null) => void;
  version: string;
}

const pyodide: PyodideRunner = {
  initialize,
  runPython,
  // NEW: Added setOutput to exported object
  setOutput,
  version,
};

expose(pyodide);
