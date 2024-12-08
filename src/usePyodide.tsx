import { Pyodide } from "./pyodide-api";
import { useAsync } from "react-async-hook";
import { getPyodide } from "./initializePyodide";

/**
 * React hook to access the global pyodide object, after loading finishes.
 */
export const usePyodide = (
  // NEW: Added options parameter
  options?: {
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  }
): {
  pyodide: Pyodide | undefined;
  loading: boolean;
  error: Error | undefined;
} => {
  const {
    result: pyodide,
    loading,
    error,
  } = useAsync(async () => {
    // NEW: Pass options to getPyodide
    const pyodide = await getPyodide(options);
    return pyodide;
  }, []);

  return { pyodide, loading, error };
};
