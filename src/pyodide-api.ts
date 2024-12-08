/**
 * Expose a pyodide API to the main thread, which executes
 * code in a web worker (via comlink).
 */
import * as Comlink from "comlink";
import { PyodideRunner } from "./pyodide-worker";
import { JSONValue } from "@holdenmatt/ts-utils";

let _worker: Worker | null = null;
let _runner: Comlink.Remote<PyodideRunner> | null = null;

export interface Pyodide {
  runPython: (code: string, globals?: Record<string, JSONValue>) => Promise<unknown>;
  runPythonJson: (
    code: string,
    globals?: Record<string, JSONValue>
  ) => Promise<JSONValue | null>;
  // NEW: Added setOutput to interface
  setOutput: (callback: ((text: string) => void) | null) => void;
  terminate: () => void;
}

/**
 * Initialize the pyodide worker and load some given packages.
 */
export const initializeWorker = async (
  packages?: string[],
  // NEW: Added options parameter for stdout/stderr
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
): Promise<Pyodide> => {
  if (!_worker) {
    _worker = new Worker(new URL("./pyodide-worker", import.meta.url));
    _runner = Comlink.wrap(_worker);
    // NEW: Only proxy options if they exist
    const proxiedOptions = options
      ? {
          stdout: options.stdout ? Comlink.proxy(options.stdout) : undefined,
          stderr: options.stderr ? Comlink.proxy(options.stderr) : undefined,
        }
      : undefined;
    await _runner.initialize(packages, proxiedOptions);
  }
  return {
    runPython,
    runPythonJson,
    // NEW: Added setOutput to returned object
    setOutput,
    terminate,
  };
};

/**
 * Run a Python code string and return the value of the last statement.
 */
const runPython = async (
  code: string,
  globals?: Record<string, JSONValue>
): Promise<unknown> => {
  if (!_worker || !_runner) {
    throw new Error("pyodide isn't loaded yet");
  }
  const value = await _runner.runPython(code, globals);
  return value;
};

/**
 * Run a Python code string, and parse its result as JSON.
 */
const runPythonJson = async (
  code: string,
  globals?: Record<string, JSONValue>
): Promise<JSONValue | null> => {
  const result = (await runPython(code, globals)) as string;
  if (result) {
    const json = JSON.parse(result) as JSONValue;
    return json;
  }
  return null;
};

// NEW: Added setOutput function
const setOutput = (callback: ((text: string) => void) | null): void => {
  if (!_runner) {
    throw new Error("pyodide isn't loaded yet");
  }
  _runner.setOutput(callback ? Comlink.proxy(callback) : null);
};

/**
 * Terminate the worker.
 */
const terminate = () => {
  _worker?.terminate();
  _worker = null;
  _runner?.[Comlink.releaseProxy]();
  _runner = null;
};
