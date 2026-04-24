import { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";

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
}) {
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const monacoRef = useRef(null);
  const yBindingRef = useRef(null);

  function handleMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("codebloc-dark", MONACO_THEME);
    monaco.editor.setTheme("codebloc-dark");

    if (ytext && awareness) {
      const model = editor.getModel();
      yBindingRef.current?.destroy?.();
      yBindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        awareness,
      );
    }

    // Cursor position change
    editor.onDidChangeCursorPosition(e => {
      onCursorChange?.({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
    });
  }

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

  const monacoLang = (file?.language || "plaintext") === "markdown" ? "markdown" : file?.language || "plaintext";

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ readOnly });
  }, [readOnly]);

  useEffect(() => {
    // When switching files, rebind if editor already mounted.
    const editor = editorRef.current;
    if (!editor || !ytext || !awareness) return;
    const model = editor.getModel();
    yBindingRef.current?.destroy?.();
    yBindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness,
    );
    return () => yBindingRef.current?.destroy?.();
  }, [file?._id, ytext, awareness]);

  return (
    <div className="h-full w-full relative">
      {/* Remote cursor CSS */}
      <style>{Object.values(cursors).map(c => `
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
      `).join("")}</style>

      {file ? (
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
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
          }}
        />
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-slate-600">
          <div className="text-6xl mb-4">📂</div>
          <p className="text-lg font-black tracking-tight">Select a file to start editing</p>
          <p className="text-sm mt-2">or create a new one from the explorer</p>
        </div>
      )}
    </div>
  );
}
