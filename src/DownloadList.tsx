import React, { useState } from "react";
import { FileSystemManager } from "./OPFS";
import { toaster } from "./Toaster";

export interface FileItem {
  handle: FileSystemFileHandle;
  path: string;
}

const DownloadList: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rootDirHandle, setRootDirHandle] =
    useState<FileSystemDirectoryHandle | null>(null);

  async function chooseDirectory() {
    try {
      const dirHandle = await FileSystemManager.openDirectory({
        mode: "readwrite",
      });
      setRootDirHandle(dirHandle);
      // Load existing files using the walk method
      const fileItems = await FileSystemManager.walk(dirHandle);
      setFiles(fileItems);
    } catch (error) {
      const message = `Directory doesn't exist or permission denied:`;
      toaster.danger(message);
      console.error(message, error);
    }
  }

  // Initialize OPFS when component mounts
  //   useEffect(() => {
  //     chooseDirectory();
  //   }, []);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!rootDirHandle) {
      await chooseDirectory();
    }

    const uploadedFiles = event.target.files;
    if (!uploadedFiles || !rootDirHandle) return;

    const newFiles: FileItem[] = [];
    for (const file of uploadedFiles) {
      try {
        const fileHandle = await FileSystemManager.createFileFromDirectory(
          rootDirHandle,
          file.name
        );
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();

        newFiles.push({
          handle: fileHandle,
          path: file.name,
        });
      } catch (error) {
        const message = `Failed to save file ${file.name}:`;
        toaster.danger(message);
        console.error(message, error);
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }

  async function handleOpen(fileItem: FileItem) {
    if (!rootDirHandle) return;

    try {
      // We know this will return a string when type is "blobUrl"
      const result = (await FileSystemManager.getFileDataFromHandle(
        fileItem.handle,
        {
          type: "blobUrl",
        }
      )) as string;
      window.open(result, "_blank");
    } catch (error) {
      const message = `Failed to open file ${fileItem.path}:`;
      toaster.danger(message);
      console.error(message, error);
    }
  }

  async function handleDelete(fileItem: FileItem) {
    if (!rootDirHandle) return;

    try {
      await FileSystemManager.deleteFileFromDirectory(
        rootDirHandle,
        fileItem.path
      );
      setFiles((prev) => prev.filter((f) => f.path !== fileItem.path));
    } catch (error) {
      console.error(`Failed to delete file ${fileItem.path}:`, error);
    }
  }

  return (
    <div className="p-4">
      <div className="p-2 space-y-2">
        <button
          onClick={chooseDirectory}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
        >
          Initialize OPFS
        </button>
        <input
          type="file"
          onChange={handleFileUpload}
          multiple
          id="file-upload"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer file:transition-colors file:duration-150"
        />
      </div>

      <div className="border rounded p-4 overflow-y-auto flex-1">
        <h2 className="text-xl font-bold mb-4">Files in OPFS</h2>
        {files.length === 0 ? (
          <p className="text-gray-500">No files uploaded yet</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <FileItemComponent
                key={file.path}
                file={file}
                onDelete={handleDelete}
                onOpen={handleOpen}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const FileItemComponent = ({
  file,
  onDelete,
  onOpen,
}: {
  file: FileItem;
  onDelete: (fileItem: FileItem) => void;
  onOpen: (fileItem: FileItem) => void;
}) => {
  return (
    <li className="flex items-center justify-between p-2 gap-2 bg-gray-50 rounded">
      <span className="text-ellipsis max-w-full break-words">{file.path}</span>
      <div className="flex items-center flex-wrap gap-2">
        <button
          onClick={() => onDelete(file)}
          className="text-red-500 hover:text-red-700 cursor-pointer select-none"
        >
          Delete
        </button>
        <button
          onClick={() => onOpen(file)}
          className="text-blue-500 hover:text-blue-700 cursor-pointer select-none"
        >
          Open in Chrome
        </button>
      </div>
    </li>
  );
};

export default DownloadList;
