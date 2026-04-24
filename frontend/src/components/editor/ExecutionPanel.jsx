import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const EXEC_API = import.meta.env.VITE_EXEC_API_URL || "http://localhost:5001";
const SUPPORTED = ["javascript", "python", "cpp"];

export default function ExecutionPanel({ content, language }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [exitCode, setExitCode] = useState(null);

  const handleRun = async () => {
    if (!content?.trim()) return;
    setRunning(true);
    setOutput(""); setError(""); setExecTime(null); setExitCode(null);

    try {
      const { data } = await axios.post(`${EXEC_API}/execute`, { code: content, language });
      setOutput(data.output);
      setError(data.error);
      setExecTime(data.executionTime);
      setExitCode(data.exitCode);
    } catch (err) {
      setError(err.response?.data?.error || "Execution service unavailable");
    } finally { setRunning(false); }
  };

  const isSupported = SUPPORTED.includes(language);
  const hasOutput = output || error;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">▶</span>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Terminal</span>
        </div>
        {execTime !== null && (
          <span className="text-[9px] font-mono text-slate-600">{execTime}ms</span>
        )}
      </div>

      {/* Run button */}
      <div className="px-3 py-3 border-b border-slate-800">
        <button
          onClick={handleRun}
          disabled={running || !isSupported || !content?.trim()}
          className="w-full py-2.5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest rounded-xl transition disabled:opacity-40"
          style={{
            background: running ? "#1e3a8a" : "#16a34a",
            color: "white",
            boxShadow: running ? "none" : "0 4px 20px rgba(22,163,74,0.3)"
          }}
        >
          {running ? (
            <>
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Executing...
            </>
          ) : (
            <>▶ Run {language}</>
          )}
        </button>

        {!isSupported && (
          <p className="text-[10px] text-slate-600 text-center mt-2 font-mono">
            Sandbox supports: {SUPPORTED.join(", ")}
          </p>
        )}
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin font-mono">
        {!hasOutput && !running && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">⚡</p>
            <p className="text-xs font-bold text-slate-700">Run your code to see output here</p>
          </div>
        )}

        {output && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">Output</span>
              {exitCode === 0 && <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold">Exit 0</span>}
            </div>
            <pre className="text-xs text-green-300 bg-slate-900 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
              {output}
            </pre>
          </div>
        )}

        {error && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Error</span>
              {exitCode !== null && exitCode !== 0 && (
                <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">Exit {exitCode}</span>
              )}
            </div>
            <pre className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
              {error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
