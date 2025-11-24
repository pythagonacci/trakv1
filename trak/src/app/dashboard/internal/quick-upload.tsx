"use client";

import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadStandaloneFile } from "@/app/actions/file";
import { getOrCreateFilesSpace } from "@/app/actions/project";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface QuickUploadProps {
  workspaceId: string;
}

export default function QuickUpload({ workspaceId }: QuickUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // Get or create the default "Files" internal space
      const spaceResult = await getOrCreateFilesSpace(workspaceId);
      
      if (spaceResult.error || !spaceResult.data) {
        alert(`Failed to get upload space: ${spaceResult.error || "Unknown error"}`);
        setUploading(false);
        return;
      }

      const projectId = spaceResult.data.id;

      // Upload each file
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        
        const result = await uploadStandaloneFile(formData, workspaceId, projectId);
        
        if (result.error) {
          alert(`Failed to upload ${file.name}: ${result.error}`);
        }
      }

      // Refresh the page to show new files
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred while uploading files.");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <Button
        onClick={handleClick}
        size="sm"
        variant="outline"
        disabled={uploading || isPending}
      >
        {uploading || isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </>
        )}
      </Button>
    </>
  );
}

