import { useEffect, useRef, useState, use, useLayoutEffect } from "react";
import { FileItem, FileItemComponent } from "./DownloadList";
import JSZip from "jszip";
import {
  DirectoryNavigationStack,
  FileSystemManager,
  humanFileSize,
  OPFS,
} from "./OPFS";
import { toaster } from "./Toaster";
import { useAppStore } from "./useStore";
import useSWR from "swr";
import { StorageUsedComponent } from "./StorageUsedComponent";

interface FileContent {
  type: "file";
  handle: FileSystemFileHandle;
}

interface DirectoryContent {
  type: "folder";
  handle: FileSystemDirectoryHandle;
}

async function getEntries(handle: FileSystemDirectoryHandle) {
  const opfs = new OPFS(handle);
  const entries = await opfs.getDirectoryContents();
  return entries.map((entry) => {
    if (entry.kind === "directory") {
      return {
        type: "folder" as const,
        handle: entry as FileSystemDirectoryHandle,
      };
    } else {
      return {
        type: "file" as const,
        handle: entry as FileSystemFileHandle,
      };
    }
  });
}

export const OPFSList: React.FC = () => {
  const [opfsInitialized, setOPFSInitialized] = useState(false);
  const opfsRef = useRef<OPFS>(new OPFS());
  const directoryStackRef = useRef<DirectoryNavigationStack | null>(null);
  const [directoryContents, setDirectoryContents] = useState<
    (FileContent | DirectoryContent)[]
  >([]);
  const { setFileSizeInDirectory, addFileSize, removeFileSize } = useAppStore();

  const getParentFolderPath = () => {
    return directoryStackRef.current?.parentFolderPath || "/";
  };

  useEffect(() => {
    async function setupOPFS() {
      const initialized = await opfsRef.current.initOPFS();
      setOPFSInitialized(initialized);
      directoryStackRef.current = new DirectoryNavigationStack(
        opfsRef.current.directoryHandle
      );
      const entries = await getEntries(opfsRef.current.directoryHandle);
      setDirectoryContents(entries);
    }

    setupOPFS();
  }, []);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = event.target.files;
    console.log("Uploaded files:", uploadedFiles);
    if (!uploadedFiles) return;
    if (!opfsInitialized) return;
    if (!directoryStackRef.current) return;

    for (const file of uploadedFiles) {
      try {
        const opfs = new OPFS(directoryStackRef.current.currentDirectory);
        const fileHandle = await opfs.createFileHandle(file.name);
        await OPFS.writeDataToFileHandle(fileHandle, file);
        addFileSize(file.size);
      } catch (error) {
        const message = `Failed to save file ${file.name}:`;
        toaster.danger(message);
        console.error(message, error);
      }
    }

    const entries = await getEntries(
      directoryStackRef.current.currentDirectory
    );
    setDirectoryContents(entries);
  }

  async function handleFileOpen(fileItem: FileItem) {
    if (!opfsInitialized) return;

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

  async function handleFileDelete(fileItem: FileItem) {
    if (!opfsInitialized) return;
    if (!directoryStackRef.current) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the file "${fileItem.handle.name}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const opfs = new OPFS(directoryStackRef.current.currentDirectory);
      console.log(directoryStackRef.current.currentDirectory);
      const fileSize = await FileSystemManager.getFileSize(fileItem.handle);
      removeFileSize(fileSize);
      await opfs.deleteFile(fileItem.handle.name);
      setDirectoryContents((prev) =>
        prev.filter((item) => item.handle.name !== fileItem.handle.name)
      );
    } catch (error) {
      console.error(
        `Failed to delete file ${fileItem.handle.name} qt path: ${fileItem.path}:`,
        error
      );
    }
  }

  async function handleFolderSelect(handle: FileSystemDirectoryHandle) {
    // 1. if not current handle, update parent handle to be OPFS root.
    //   a) if current handle, then set parent handle to be the current handle.
    // 2. set current handle to be the new handle.
    // 3. get and set directory contents of the new handle.

    if (!opfsInitialized) return;

    if (!directoryStackRef.current) return;
    directoryStackRef.current.push(handle);

    setFileSizeInDirectory(0);
    const entries = await getEntries(handle);
    setDirectoryContents(entries);
  }

  async function handleParentFolderSelect() {
    if (!opfsInitialized) return;
    if (!directoryStackRef.current) return;

    // 1. if already at root, don't do anything.
    if (directoryStackRef.current.isRoot) return;
    // 2. pop the current handle from the stack.
    directoryStackRef.current.pop();
    setFileSizeInDirectory(0);
    // 3. set directory contents based on top of the stack.
    const entries = await getEntries(
      directoryStackRef.current.currentDirectory
    );
    setDirectoryContents(entries);
  }

  async function handleFolderDelete(handle: FileSystemDirectoryHandle) {
    if (!opfsInitialized) return;
    if (!directoryStackRef.current) return;

    try {
      const opfs = new OPFS(directoryStackRef.current.currentDirectory);
      const confirmDelete = window.confirm(
        `Are you sure you want to delete the folder "${handle.name}"? This action cannot be undone.`
      );
      if (!confirmDelete) return;
      await opfs.deleteFolder(handle.name);
      setDirectoryContents((prev) =>
        prev.filter((item) => item.handle.name !== handle.name)
      );
    } catch (error) {
      toaster.danger(`Failed to delete folder ${handle.name}:`);
      console.error(`Failed to delete folder ${handle.name}:`, error);
    }
  }

  async function handleDrop(
    e: React.DragEvent<HTMLLIElement>,
    destinationHandle: FileSystemDirectoryHandle
  ) {
    e.preventDefault();
    if (!directoryStackRef.current) return;

    const item = e.dataTransfer.getData("application/json");
    if (!item) return;

    const { name, type } = JSON.parse(item);
    const opfs = new OPFS(directoryStackRef.current.currentDirectory);
    const handle = directoryContents.find(
      (item) => item.handle.name === name && item.type === type
    )?.handle;

    if (!handle) return;

    if (handle.kind === "directory") {
      if (handle.name === destinationHandle.name) {
        return;
      }
      const isDescendant = await FileSystemManager.isDescendant(
        handle as FileSystemDirectoryHandle,
        destinationHandle
      );
      if (isDescendant) {
        toaster.danger("Cannot move a folder into one of its subfolders.");
        return;
      }
    }

    if (
      directoryStackRef.current.currentDirectory.name ===
      destinationHandle.name
    ) {
      return;
    }
    await opfs.move(handle, destinationHandle);
    const entries = await getEntries(
      directoryStackRef.current.currentDirectory
    );
    setDirectoryContents(entries);
  }

  async function createFolder() {
    const folderName = prompt(
      "Enter folder name: (this cannot be changed later"
    );

    if (!opfsInitialized) return;
    if (!directoryStackRef.current) return;
    if (!folderName) return;

    try {
      const opfs = new OPFS(directoryStackRef.current.currentDirectory);
      const keys = await opfs.getDirectoryContentNames();
      if (keys.includes(folderName)) {
        toaster.info(`Folder ${folderName} already exists.`);
        return;
      }
      const folderHandle = (await opfs.createDirectory(folderName))
        .directoryHandle;
      setDirectoryContents((prev) => [
        ...prev,
        {
          type: "folder",
          handle: folderHandle,
        },
      ]);
    } catch (error) {
      toaster.danger(`Failed to create folder ${folderName}:`);
      console.error(`Failed to create folder ${folderName}:`, error);
    }
  }

  async function handleFolderDownload(handle: FileSystemDirectoryHandle) {
    if (!opfsInitialized) return;

    try {
      const zip = new JSZip();
      const files = await FileSystemManager.walk(handle);

      for (const file of files) {
        const fileData = await FileSystemManager.getFileDataFromHandle(
          file.handle
        );
        zip.file(file.path, fileData as Blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${handle.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toaster.danger(`Failed to download folder ${handle.name}:`);
      console.error(`Failed to download folder ${handle.name}:`, error);
    }
  }

  return (
    <div className="p-4">
      <div className="p-2 flex flex-row gap-2 items-center justify-between">
        <button
          className="bg-blue-500 text-white font-semibold text-base hover:bg-blue-700 transition-colors duration-150 cursor-pointer rounded-lg px-4 py-2"
          onClick={createFolder}
        >
          + New Folder
        </button>
        <input
          type="file"
          onChange={handleFileUpload}
          multiple
          id="file-upload"
          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer file:transition-colors file:duration-150"
        />
      </div>

      <div
        className="border rounded p-4 overflow-y-auto flex-1"
        // TODO: add throttle
        onDragOver={(e) => {
          console.log(e.currentTarget);
        }}
      >
        <h2 className="text-xl font-bold mb-4">Files in OPFS</h2>
        <StorageUsedComponent />
        <div className="flex gap-x-2 items-baseline">
          <h3 className="text-base font-semibold text-gray-400">
            Current Directory:{" "}
            {(directoryStackRef.current?.currentDirectory.name || "root").slice(
              0,
              49
            )}
          </h3>
          <FolderSizeComponent />
        </div>
        <FolderContentsList
          contents={directoryContents}
          handleFileDelete={handleFileDelete}
          handleFileOpen={handleFileOpen}
          onFolderDelete={handleFolderDelete}
          onFolderSelect={handleFolderSelect}
          onParentFolderSelect={handleParentFolderSelect}
          parentFolderPath={getParentFolderPath()}
          onFolderDownload={handleFolderDownload}
          onDrop={handleDrop}
          directoryStack={directoryStackRef.current}
        />
      </div>
    </div>
  );
};

const FolderSizeComponent = () => {
  const { fileSizeInDirectory } = useAppStore();

  return <span>{humanFileSize(fileSizeInDirectory, 2)}</span>;
};

const FolderContentsList = ({
  contents,
  handleFileDelete,
  handleFileOpen,
  onFolderDelete,
  onFolderSelect,
  onParentFolderSelect,
  parentFolderPath,
  onFolderDownload,
  onDrop,
  directoryStack,
}: {
  contents: (DirectoryContent | FileContent)[];
  handleFileDelete: (fileItem: FileItem) => void;
  handleFileOpen: (fileItem: FileItem) => void;
  onFolderDelete: (handle: FileSystemDirectoryHandle) => void;
  onFolderSelect: (handle: FileSystemDirectoryHandle) => void;
  onFolderDownload: (handle: FileSystemDirectoryHandle) => void;
  onParentFolderSelect: () => void;
  parentFolderPath: string;
  onDrop: (
    e: React.DragEvent<HTMLLIElement>,
    destinationHandle: FileSystemDirectoryHandle
  ) => void;
  directoryStack: DirectoryNavigationStack | null;
}) => {
  const { addFileSize, setFileSizeInDirectory } = useAppStore();

  useLayoutEffect(() => {
    async function getFileSizes() {
      setFileSizeInDirectory(0);
      for (const item of contents) {
        if (item.type === "file") {
          const fileSize = await FileSystemManager.getFileSize(item.handle);
          addFileSize(fileSize);
        }
      }
    }

    getFileSizes();
  }, [contents]);
  if (contents.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-gray-500 select-none">No files uploaded yet</p>
        <ParentFolderItemComponent
          onParentFolderSelect={onParentFolderSelect}
          onDrop={onDrop}
          directoryStack={directoryStack}
        />
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto">
      <ParentFolderItemComponent
        onParentFolderSelect={onParentFolderSelect}
        onDrop={onDrop}
        directoryStack={directoryStack}
      />
      {contents.map((item) => {
        if (item.type === "folder") {
          return (
            <FolderItemComponent
              handle={item.handle}
              key={item.handle.name}
              onFolderDelete={onFolderDelete}
              onFolderSelect={onFolderSelect}
              onFolderDownload={onFolderDownload}
              onDrop={onDrop}
            />
          );
        } else {
          return (
            <FileItemComponent
              key={item.handle.name}
              file={{
                handle: item.handle,
                path: `${parentFolderPath}${item.handle.name}`,
              }}
              onDelete={handleFileDelete}
              onOpen={handleFileOpen}
              isInOPFS
            />
          );
        }
      })}
    </ul>
  );
};

const FolderItemComponent = ({
  handle,
  onFolderDelete,
  onFolderSelect,
  onFolderDownload,
  onDrop,
}: {
  handle: FileSystemDirectoryHandle;
  onFolderDelete: (handle: FileSystemDirectoryHandle) => void;
  onFolderSelect: (handle: FileSystemDirectoryHandle) => void;
  onFolderDownload: (handle: FileSystemDirectoryHandle) => void;
  onDrop: (
    e: React.DragEvent<HTMLLIElement>,
    destinationHandle: FileSystemDirectoryHandle
  ) => void;
}) => {
  return (
    <li
      className="flex items-center justify-between p-2 gap-2 bg-gray-50 rounded hover:bg-gray-200 transition-colors duration-200"
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFolderSelect(handle);
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ name: handle.name, type: "folder" })
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDrop={(e) => onDrop(e, handle)}
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      <div className="flex items-center gap-x-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-gray-600"
        >
          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
        </svg>
        <span className="text-ellipsis max-w-[40ch] break-words">
          {handle.name}
        </span>
      </div>
      <div className="flex gap-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFolderDownload(handle);
          }}
          className="text-blue-500 hover:text-blue-700 cursor-pointer select-none"
        >
          Download
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFolderDelete(handle);
          }}
          className="text-red-500 hover:text-red-700 cursor-pointer select-none"
        >
          Delete
        </button>
      </div>
    </li>
  );
};

export const ParentFolderItemComponent = ({
  onParentFolderSelect,
  onDrop,
  directoryStack,
}: {
  onParentFolderSelect: () => void;
  onDrop: (
    e: React.DragEvent<HTMLLIElement>,
    destinationHandle: FileSystemDirectoryHandle
  ) => void;
  directoryStack: DirectoryNavigationStack | null;
}) => {
  return (
    <li
      className="flex items-center justify-between p-2 gap-2 bg-gray-50 rounded hover:bg-gray-200 transition-colors duration-200 select-none"
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onParentFolderSelect();
      }}
      onDrop={(e) => {
        if (directoryStack && !directoryStack.isRoot) {
          const parentHandle = directoryStack.parentDirectoryHandle;
          if (parentHandle) {
            onDrop(e, parentHandle);
          }
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      <div className="flex items-center gap-x-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-gray-600"
        >
          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
        </svg>
        <span>..</span>
      </div>
    </li>
  );
};
