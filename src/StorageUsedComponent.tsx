import React from "react";
import useSWR from "swr";
import { FileSystemManager, humanFileSize } from "./OPFS";

async function getStorageInfo() {
  const info = await FileSystemManager.getStorageInfo();
  return {
    percentUsed: info.storagePercentageUsed,
    bytesUsed: humanFileSize(info.bytesUsed),
    bytesAvailable: humanFileSize(info.bytesAvailable),
  };
}

export const StorageUsedComponent = () => {
  const { data, error, isLoading } = useSWR("storageInfo", async () => {
    const info = await getStorageInfo();
    return info;
  });

  if (isLoading) return <span>Loading...</span>;
  if (!data) return null;
  return (
    <p className="text-gray-500 font-semibold text-sm">
      Total Storage: {data.bytesUsed} / {data.bytesAvailable}
    </p>
  );
};
