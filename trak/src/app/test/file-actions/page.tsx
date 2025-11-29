'use client';

import { useState } from 'react';
import {
  uploadFile,
  attachFileToBlock,
  getBlockFiles,
  getFileUrl,
  detachFileFromBlock,
  deleteFile,
} from '@/app/actions/file';

export default function FileActionsTestPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [fileId, setFileId] = useState('');
  const [attachmentId, setAttachmentId] = useState('');

  const testUpload = async () => {
    setLoading(true);
    setResult('Testing uploadFile...\n');

    if (!workspaceId || !projectId) {
      setResult(prev => prev + `❌ Please enter workspace ID and project ID\n`);
      setLoading(false);
      return;
    }

    try {
      const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', testFile);

      const response = await uploadFile(formData, workspaceId, projectId);

      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ Uploaded! File ID: ${response.data?.id}\n`);
        if (response.data?.id) setFileId(response.data.id);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  const testAttach = async () => {
    setLoading(true);
    setResult(prev => prev + `\nTesting attachFileToBlock...\n`);

    if (!fileId || !blockId) {
      setResult(prev => prev + `❌ Please upload a file first and enter block ID\n`);
      setLoading(false);
      return;
    }

    try {
      const response = await attachFileToBlock(fileId, blockId, 'inline');
      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ Attached! Attachment ID: ${response.data?.id}\n`);
        if (response.data?.id) setAttachmentId(response.data.id);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  const testGetBlockFiles = async () => {
    setLoading(true);
    setResult(prev => prev + `\nTesting getBlockFiles...\n`);

    if (!blockId) {
      setResult(prev => prev + `❌ Please enter block ID\n`);
      setLoading(false);
      return;
    }

    try {
      const response = await getBlockFiles(blockId);
      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ Found ${response.data?.length || 0} file(s)\n`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  const testGetUrl = async () => {
    setLoading(true);
    setResult(prev => prev + `\nTesting getFileUrl...\n`);

    if (!fileId) {
      setResult(prev => prev + `❌ Please upload a file first\n`);
      setLoading(false);
      return;
    }

    try {
      const response = await getFileUrl(fileId);
      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ URL: ${response.data?.url}\n`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  const testDetach = async () => {
    setLoading(true);
    setResult(prev => prev + `\nTesting detachFileFromBlock...\n`);

    if (!attachmentId) {
      setResult(prev => prev + `❌ Please attach a file first\n`);
      setLoading(false);
      return;
    }

    try {
      const response = await detachFileFromBlock(attachmentId);
      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ Detached!\n`);
        setAttachmentId('');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  const testDelete = async () => {
    setLoading(true);
    setResult(prev => prev + `\nTesting deleteFile...\n`);

    if (!fileId) {
      setResult(prev => prev + `❌ Please upload a file first\n`);
      setLoading(false);
      return;
    }

    try {
      const response = await deleteFile(fileId);
      if (response.error) {
        setResult(prev => prev + `❌ ${response.error}\n`);
      } else {
        setResult(prev => prev + `✅ Deleted!\n`);
        setFileId('');
        setAttachmentId('');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    }

    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">File Actions Test</h1>
      <p className="text-gray-600 mb-6">Simple test interface for file actions</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Workspace ID</label>
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter workspace ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter project ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Block ID</label>
          <input
            type="text"
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter block ID (optional)"
          />
        </div>
        {fileId && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm"><strong>File ID:</strong> {fileId}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testUpload}
          disabled={loading || !workspaceId || !projectId}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Upload File
        </button>
        <button
          onClick={testAttach}
          disabled={loading || !fileId || !blockId}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Attach to Block
        </button>
        <button
          onClick={testGetBlockFiles}
          disabled={loading || !blockId}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
        >
          Get Block Files
        </button>
        <button
          onClick={testGetUrl}
          disabled={loading || !fileId}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400"
        >
          Get File URL
        </button>
        <button
          onClick={testDetach}
          disabled={loading || !attachmentId}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400"
        >
          Detach File
        </button>
        <button
          onClick={testDelete}
          disabled={loading || !fileId}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          Delete File
        </button>
      </div>

      <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
        {result || 'Enter IDs above and click buttons to test...'}
      </pre>
    </div>
  );
}
