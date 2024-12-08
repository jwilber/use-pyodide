import { logElapsedTime } from "@holdenmatt/ts-utils";
import { initializeWorker, Pyodide } from "./pyodide-api";
import { DEBUG, setDebug } from "./config";

let pyodide: Promise<Pyodide> | undefined;

/**
 * Initialize Pyodide, ensuring we only initialize it once.
 *
 * @param debug If true, log debug messages and elapsed times to the console.
 * @param packages Additional python package names to load.
 */
export async function initializePyodide(options?: {
  debug?: boolean;
  packages?: string[];
  // NEW: Added stdout/stderr options
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}): Promise<Pyodide> {
  // NEW: Destructured stdout and stderr from options
  const { debug = false, packages, stdout, stderr } = options || {};
  setDebug(debug);
  if (pyodide === undefined) {
    // NEW: Only pass stdout/stderr if they exist
    const workerOptions = stdout || stderr ? { stdout, stderr } : undefined;
    pyodide = _initializePyodide(packages, workerOptions);
  }
  return pyodide;
}

/**
 * Initialize Pyodide, and load any given packages.
 */
const _initializePyodide = async (
  packages?: string[],
  // NEW: Added options parameter
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
): Promise<Pyodide> => {
  const start = performance.now();
  // NEW: Pass options to initializeWorker only if they exist
  pyodide = initializeWorker(packages, options);
  DEBUG && logElapsedTime("Pyodide initialized", start);
  return pyodide;
};

/**
 * Get the pyodide instance, initializing it if needed.
 *
 * Typically `usePyodide` is used in React components instead, but this
 * method provides access outside of React contexts.
 */
export const getPyodide = async (
  // NEW: Added options parameter
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
): Promise<Pyodide> => {
  if (pyodide) {
    return pyodide;
  } else {
    // NEW: Pass options to initializePyodide
    return await initializePyodide(options);
  }
};
