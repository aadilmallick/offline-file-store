import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { OPFS } from "./OPFS";
import { toaster } from "./Toaster";

const MarkdownPreview: React.FC = () => {
  const { file_handle_id } = useParams<{ file_handle_id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<string>("");
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadFile() {
      if (!file_handle_id) return;
      try {
        const filePath = atob(file_handle_id);
        const opfs = new OPFS();
        await opfs.initOPFS();

        const parts = filePath.split('/').filter(Boolean);
        let currentHandle: FileSystemDirectoryHandle = opfs.directoryHandle;

        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        const handle = await currentHandle.getFileHandle(parts[parts.length - 1]);
        setFileHandle(handle);

        const file = await handle.getFile();
        const text = await file.text();
        setContent(text);
      } catch (error) {
        console.error("Error loading markdown file:", error);
        toaster.danger("Failed to load markdown file");
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [file_handle_id, navigate]);

  const saveContent = useCallback(async (newContent: string, handle: FileSystemFileHandle) => {
    try {
      await OPFS.writeDataToFileHandle(handle, newContent);
      toaster.info("File saved");
    } catch (error) {
      console.error("Error saving file:", error);
      toaster.danger("Failed to save file");
    }
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (fileHandle) {
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(newContent, fileHandle);
      }, 1000);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 border-b flex justify-between items-center bg-white">
        <h1 className="text-xl font-bold truncate">
          Preview: {fileHandle?.name}
        </h1>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Back to Dashboard
        </button>
      </header>
      <main className="flex-1 overflow-hidden">
        <PanelGroup orientation="horizontal">
          <Panel defaultSize={50} minSize={0} collapsible>
            <textarea
              className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-gray-50"
              value={content}
              onChange={handleContentChange}
              placeholder="Write your markdown here..."
            />
          </Panel>
          <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />
          <Panel defaultSize={50} minSize={0} collapsible>
            <div className="h-full overflow-y-auto p-8 prose max-w-none bg-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => {
                    const childrenArray = React.Children.toArray(children);
                    // Check if the children start with ![NOTE]
                    // react-markdown might parse ![NOTE] as an image or just text depending on context
                    const firstChild = childrenArray[0];
                    let isNote = false;
                    let noteContent = childrenArray;

                    if (
                      React.isValidElement(firstChild) &&
                      firstChild.type === "img" &&
                      (firstChild.props as { alt?: string }).alt === "NOTE"
                    ) {
                      isNote = true;
                      noteContent = childrenArray.slice(1);
                    } else if (typeof firstChild === "string" && firstChild.startsWith("![NOTE]")) {
                      isNote = true;
                      noteContent = [firstChild.replace("![NOTE]", ""), ...childrenArray.slice(1)];
                    }

                    if (isNote) {
                      return (
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 text-blue-800">
                          {noteContent}
                        </div>
                      );
                    }
                    return <p>{children}</p>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </Panel>
        </PanelGroup>
      </main>
    </div>
  );
};

export default MarkdownPreview;
