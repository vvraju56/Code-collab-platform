import { useRef, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import axios from "axios";
import { useSocket } from "../../context/SocketContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MONACO_THEME = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "5c6773", fontStyle: "italic" },
    { token: "keyword", foreground: "cf8dff" },
    { token: "string", foreground: "89d185" },
    { token: "number", foreground: "f78c6c" },
    { token: "type", foreground: "4ec9b0" },
    { token: "function", foreground: "dcdcaa" },
    { token: "variable", foreground: "9cdcfe" }
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editorLineNumber.foreground": "#30363d",
    "editorLineNumber.activeForeground": "#6e7681",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#264f7860",
    "editorCursor.foreground": "#58a6ff",
    "editor.lineHighlightBackground": "#161b22",
    "editorGutter.background": "#0d1117",
    "editorWidget.background": "#161b22",
    "editorWidget.border": "#30363d",
    "input.background": "#0d1117",
    "input.border": "#30363d",
    "scrollbarSlider.background": "#30363d66",
    "scrollbarSlider.hoverBackground": "#30363daa",
    "scrollbarSlider.activeBackground": "#58a6ff66"
  }
};

export default function CollabEditor({
  file,
  content,
  onChange,
  onCursorChange,
  cursors = {},
  ydoc,
  ytext,
  awareness,
  readOnly = false,
  projectId
}) {
  const { socket } = useSocket();
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const breakpointDecorationsRef = useRef([]);
  const executionLineDecorationRef = useRef(null);
  const monacoRef = useRef(null);
  const yBindingRef = useRef(null);
  const aiProviderRef = useRef(null);
  const [breakpoints, setBreakpoints] = useState({}); // line -> boolean

function handleMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("codebloc-dark", MONACO_THEME);
    monaco.editor.setTheme("codebloc-dark");

    // AI Inline Suggestions Provider - store disposable
    try {
      const disposable = monaco.languages.registerInlineCompletionsProvider(
        { pattern: "**" },
        {
          provideInlineCompletions: async (model, position) => {
            const code = model.getValue();
            const language = model.getLanguageId();
            
            try {
              const { data } = await axios.post(`${API}/ai/suggest`, {
                code: code.substring(0, model.getOffsetAt(position)),
                language,
                fileName: file?.name || "unnamed"
              });

              if (data.ok && data.suggestion) {
                return {
                  items: [{
                    insertText: data.suggestion,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    )
                  }]
                };
              }
            } catch (e) {
              // Silent fail
            }
            return { items: [] };
          }
        }
      );
      aiProviderRef.current = disposable;
    } catch (e) {
      console.warn('AI suggestions not available');
}

    // Breakpoint toggle on gutter click
    editor.onMouseDown((e) => {
      if (e.target.type === 2) { // Gutter margin
        const line = e.target.position.lineNumber;
        toggleBreakpoint(line);
      }
    });

    // Cursor position change
    editor.onDidChangeCursorPosition(e => {
      onCursorChange?.({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
    });
  }

  const toggleBreakpoint = (line) => {
    setBreakpoints(prev => {
      const newState = { ...prev };
      if (newState[line]) {
        delete newState[line];
        socket.emit("debug_event", { projectId, event: "breakpoint_removed", data: { line, fileId: file?._id } });
      } else {
        newState[line] = true;
        socket.emit("debug_event", { projectId, event: "breakpoint_added", data: { line, fileId: file?._id } });
      }
      return newState;
    });
  };

  // Sync Debug Events
  useEffect(() => {
    if (!socket) return;

    const handleDebugEvent = ({ event, data }) => {
      if (event === "breakpoint_added") {
        if (data.fileId === file?._id) {
          setBreakpoints(prev => ({ ...prev, [data.line]: true }));
        }
      } else if (event === "breakpoint_removed") {
        if (data.fileId === file?._id) {
          setBreakpoints(prev => {
            const n = { ...prev };
            delete n[data.line];
            return n;
          });
        }
      } else if (event === "execution_paused") {
        if (data.fileId === file?._id) {
          highlightExecutionLine(data.line);
        }
      }
    };

    socket.on("debug_event", handleDebugEvent);
    return () => socket.off("debug_event", handleDebugEvent);
  }, [socket, file?._id]);

  const highlightExecutionLine = (line) => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const decoration = [{
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: "execution-line-highlight",
        glyphMarginClassName: "execution-glyph-margin"
      }
    }];

    executionLineDecorationRef.current = editor.deltaDecorations(
      executionLineDecorationRef.current,
      decoration
    );
    
    editor.revealLineInCenterIfOutsideViewport(line);
  };

  // Render Breakpoints
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const newDecorations = Object.keys(breakpoints).map(line => ({
      range: new monaco.Range(Number(line), 1, Number(line), 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: "breakpoint-glyph"
      }
    }));

    breakpointDecorationsRef.current = editor.deltaDecorations(
      breakpointDecorationsRef.current,
      newDecorations
    );
  }, [breakpoints]);

  // Render remote cursors as decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const newDecorations = Object.values(cursors).map(cursor => ({
      range: new monaco.Range(
        cursor.line || 1,
        cursor.column || 1,
        cursor.line || 1,
        (cursor.column || 1) + 1
      ),
      options: {
        className: "remote-cursor-line",
        afterContentClassName: `remote-cursor-label-${cursor.socketId?.replace(/[^a-z0-9]/gi, "")}`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        overviewRuler: { color: cursor.cursorColor || "#58a6ff", position: 4 }
      }
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [cursors]);

  const monacoLang = file?.language || "javascript";

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ readOnly });
  }, [readOnly]);

  useEffect(() => {
    // When switching files, rebind if editor already mounted.
    const editor = editorRef.current;
    if (!editor) {
      console.log('[CollabEditor] Waiting for editor...');
      return;
    }
    if (!ytext) {
      console.log('[CollabEditor] No ytext yet, file:', file?._id);
      return;
    }
    if (!awareness) {
      console.log('[CollabEditor] No awareness yet');
      return;
    }
    
    const model = editor.getModel();
    if (!model) return;

    console.log('[CollabEditor] Creating MonacoBinding for file:', file?._id);

    // Safely update language if it differs
    try {
      if (model.getLanguageId() !== monacoLang) {
        monacoRef.current?.editor.setModelLanguage(model, monacoLang);
      }
    } catch (e) {
      console.warn("Monaco language sync failed:", e);
    }

    yBindingRef.current?.destroy?.();
    yBindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness,
    );
    console.log('[CollabEditor] MonacoBinding created successfully');
    return () => yBindingRef.current?.destroy?.();
  }, [file?._id, ytext, awareness, monacoLang, editorRef.current]);

  return (
    <div className="h-full w-full relative">
      {/* Remote cursor and Debugging CSS */}
      <style>{`
        .breakpoint-glyph {
          background: #ff4d4d;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          margin-left: 4px;
        }
        .execution-line-highlight {
          background: rgba(255, 255, 0, 0.2);
        }
        .execution-glyph-margin {
          background: #ffcc00;
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 10px solid #ffcc00;
          margin-left: 5px;
        }
        ${Object.values(cursors).map(c => `
        .remote-cursor-label-${c.socketId?.replace(/[^a-z0-9]/gi, "")}::after {
          content: "${c.username || "?"}" !important;
          background: ${c.cursorColor || "#58a6ff"} !important;
          color: #fff !important;
          font-size: 11px !important;
          font-family: "JetBrains Mono", monospace !important;
          padding: 1px 6px !important;
          border-radius: 4px 4px 4px 0 !important;
          white-space: nowrap !important;
          position: absolute !important;
          top: -20px !important;
          left: 0 !important;
          z-index: 100 !important;
          pointer-events: none !important;
        }
        .remote-cursor-label-${c.socketId?.replace(/[^a-z0-9]/gi, "")} {
          border-left: 2px solid ${c.cursorColor || "#58a6ff"} !important;
          height: 18px !important;
          display: inline-block !important;
        }
      `).join("")}
      `}</style>

      {file && ytext && awareness ? (
        <Editor
          height="100%"
          language={monacoLang}
          value={content}
          onChange={val => onChange?.(val || "")}
          onMount={handleMount}
          theme="codebloc-dark"
          options={{
            readOnly,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontLigatures: true,
            lineHeight: 22,
            tabSize: 2,
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderWhitespace: "selection",
            wordWrap: "on",
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            mouseWheelZoom: true,
            suggest: { showWords: true },
            formatOnPaste: true,
            formatOnType: false,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            glyphMargin: true
          }}
        />
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-slate-600">
          <div className="text-6xl mb-4">📂</div>
          <p className="text-lg font-black tracking-tight">
            {!file ? "Select a file to start editing" : "Initializing editor..."}
          </p>
          <p className="text-sm mt-2">
            {!file ? "or create a new one from the explorer" : "Establishing real-time connection..."}
          </p>
        </div>
      )}
    </div>
  );
}
