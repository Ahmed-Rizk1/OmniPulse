"use client";

import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadKnowledgeDocument } from "@/lib/api";
import { UploadProgress } from "./UploadProgress";
import { Upload, Plus } from "lucide-react";

interface UploadDocButtonProps {
  tenantId: string;
  token?: string | null;
}

export function UploadDocButton({ tenantId, token }: UploadDocButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [step, setStep] = useState<"uploading" | "chunking" | "embedding" | "done" | "error">("uploading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCurrentFile(file.name);
    setIsUploading(true);
    setStep("uploading");
    setErrorMessage("");

    try {
      // Step progression indication
      setTimeout(() => setStep("chunking"), 300);
      setTimeout(() => setStep("embedding"), 800);

      await uploadKnowledgeDocument(file, tenantId, token);

      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", tenantId] });
      setTimeout(() => {
        setIsUploading(false);
        setStep("uploading");
      }, 1200);
    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message : "Failed to upload and vectorize document.";
      setErrorMessage(msg);
    } finally {
      // Reset file input so user can re-upload if needed
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
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isUploading}
        className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        <span>Upload Document</span>
      </button>

      <UploadProgress
        fileName={currentFile}
        isUploading={isUploading}
        step={step}
        errorMessage={errorMessage}
        onClose={() => setIsUploading(false)}
      />
    </>
  );
}
