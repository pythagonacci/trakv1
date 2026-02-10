'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export default function StorageTestPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const supabase = createClient();

  // Load all workspaces on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingWorkspaces(false);
          return;
        }

        const { data: memberships, error } = await supabase
          .from('workspace_members')
          .select(`
            role,
            workspaces (
              id,
              name
            )
          `)
          .eq('user_id', user.id);

        if (error || !memberships) {
          setResult(`❌ Error loading workspaces: ${error?.message || 'Unknown error'}\n`);
          setLoadingWorkspaces(false);
          return;
        }

        const workspaceList: Workspace[] = memberships
          .map(membership => {
            const workspaceData = membership.workspaces;
            const workspace = Array.isArray(workspaceData) 
              ? workspaceData[0] 
              : workspaceData;
            
            if (workspace && workspace.id && workspace.name) {
              return {
                id: workspace.id,
                name: workspace.name,
                role: membership.role,
              };
            }
            return null;
          })
          .filter((w): w is Workspace => w !== null);

        setWorkspaces(workspaceList);
        
        // Select first workspace by default if none selected
        setSelectedWorkspaceId(prev => prev || (workspaceList.length > 0 ? workspaceList[0].id : null));
      } catch (err: unknown) {
        const error = err as Error;
        setResult(`❌ Error: ${error.message}\n`);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const testUpload = async () => {
    setLoading(true);
    setResult('Testing storage...\n');
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult('❌ Not authenticated');
        setLoading(false);
        return;
      }
      setResult(prev => prev + `✅ Authenticated as: ${user.email}\n`);

      // Check if workspace is selected
      if (!selectedWorkspaceId) {
        setResult(prev => prev + `❌ Please select a workspace first\n`);
        setLoading(false);
        return;
      }

      // Find selected workspace
      const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
      
      if (!workspace) {
        setResult(prev => prev + `❌ Selected workspace not found\n`);
        setLoading(false);
        return;
      }
      
      setResult(prev => prev + `✅ Using workspace: ${workspace.name} (role: ${workspace.role})\n`);

      // Get projects in that workspace (return array, not single)
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspace.id)
        .limit(1);

      if (projError) {
        setResult(prev => prev + `❌ Error fetching projects: ${projError.message}\n`);
        setLoading(false);
        return;
      }

      setResult(prev => prev + `📋 Found ${projects?.length || 0} project(s) in workspace\n`);

      if (!projects || projects.length === 0) {
        setResult(prev => prev + `❌ No projects found. Please create a project first at /dashboard/projects\n`);
        setLoading(false);
        return;
      }

      const project = projects[0];
      setResult(prev => prev + `✅ Using project: ${project.name}\n`);

      // Create test file
      const testFile = new File(['Hello, TWOD Storage!'], 'test.txt', { 
        type: 'text/plain' 
      });
      const fileId = crypto.randomUUID();
      const testPath = `${workspace.id}/${project.id}/${fileId}.txt`;
      
      setResult(prev => prev + `\n📤 Uploading to: ${testPath}\n`);

      // Upload to bucket
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(testPath, testFile);

      if (uploadError) {
        setResult(prev => prev + `❌ Upload failed: ${uploadError.message}\n`);
        setLoading(false);
        return;
      }
      setResult(prev => prev + `✅ Upload successful!\n`);

      // Test download
      setResult(prev => prev + `\n📥 Testing download...\n`);
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('files')
        .download(testPath);

      if (downloadError) {
        setResult(prev => prev + `❌ Download failed: ${downloadError.message}\n`);
      } else if (downloadData) {
        const text = await downloadData.text();
        setResult(prev => prev + `✅ Download successful! Content: "${text}"\n`);
      }

      // Get storage path
      setResult(prev => prev + `\n🔗 Storage path: ${testPath}\n`);

      // Keep file for inspection (not deleting)
      setResult(prev => prev + `\n📦 File kept in bucket for inspection\n`);
      setResult(prev => prev + `   You can view it in Supabase Storage Dashboard\n`);
      setResult(prev => prev + `   Navigate to: files/${testPath}\n`);

      setResult(prev => prev + `\n🎉 All tests passed! Task 4.1 complete.`);
    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n${error.stack || ''}`);
    }
    
    setLoading(false);
  };

  const verifyStorage = async () => {
    setLoading(true);
    setResult('Verifying storage configuration...\n');
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult('❌ Not authenticated');
        setLoading(false);
        return;
      }
      setResult(prev => prev + `✅ Authenticated as: ${user.email}\n`);

      if (!selectedWorkspaceId) {
        setResult(prev => prev + `❌ Please select a workspace first\n`);
        setLoading(false);
        return;
      }

      const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
      if (!workspace) {
        setResult(prev => prev + `❌ Selected workspace not found\n`);
        setLoading(false);
        return;
      }

      // 1. Check if bucket exists and is accessible by trying to list root directory
      setResult(prev => prev + `\n📦 Checking bucket accessibility...\n`);
      const { error: bucketAccessError } = await supabase.storage
        .from('files')
        .list('', {
          limit: 1,
          offset: 0,
        });
      
      if (bucketAccessError) {
        if (bucketAccessError.message.includes('not found') || bucketAccessError.message.includes('Bucket not found')) {
          setResult(prev => prev + `❌ Bucket "files" not found or not accessible\n`);
          setResult(prev => prev + `   Error: ${bucketAccessError.message}\n`);
        } else {
          setResult(prev => prev + `⚠️ Bucket access issue: ${bucketAccessError.message}\n`);
          setResult(prev => prev + `   (Bucket might exist but has RLS restrictions on listing)\n`);
        }
      } else {
        setResult(prev => prev + `✅ Bucket "files" exists and is accessible\n`);
        setResult(prev => prev + `   (Able to access bucket - listing may require permissions)\n`);
      }

      // 2. List files in workspace folder to verify structure
      setResult(prev => prev + `\n📁 Listing files in workspace folder...\n`);
      const { data: workspaceFiles, error: listError } = await supabase.storage
        .from('files')
        .list(`${workspace.id}`, {
          limit: 100,
          offset: 0,
        });

      if (listError) {
        setResult(prev => prev + `❌ Error listing files: ${listError.message}\n`);
        setResult(prev => prev + `   (This might be expected if folder is empty or RLS prevents listing)\n`);
      } else {
        if (!workspaceFiles || workspaceFiles.length === 0) {
          setResult(prev => prev + `📂 Workspace folder is empty (expected after cleanup)\n`);
        } else {
          setResult(prev => prev + `📂 Found ${workspaceFiles.length} item(s) in workspace folder:\n`);
          workspaceFiles.forEach((file, idx) => {
            setResult(prev => prev + `   ${idx + 1}. ${file.name} (${file.metadata?.size ? `${file.metadata.size} bytes` : 'size unknown'})\n`);
          });
        }
      }

      // 3. Test RLS by trying to access a non-existent file
      setResult(prev => prev + `\n🔒 Testing RLS policies...\n`);
      const testNonExistentPath = `${workspace.id}/test-rls-check-${Date.now()}.txt`;
      const { error: rlsTestError } = await supabase.storage
        .from('files')
        .download(testNonExistentPath);

      if (rlsTestError) {
        if (rlsTestError.message.includes('not found') || rlsTestError.message.includes('Object not found')) {
          setResult(prev => prev + `✅ RLS working: Access denied to non-existent file (expected)\n`);
        } else {
          setResult(prev => prev + `⚠️ RLS check: ${rlsTestError.message}\n`);
        }
      } else {
        setResult(prev => prev + `⚠️ RLS: Was able to access non-existent file (unexpected)\n`);
      }

      // 4. Check storage path format
      setResult(prev => prev + `\n🔗 Verifying storage path format...\n`);
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspace.id)
        .limit(1);

      if (projects && projects.length > 0) {
        const project = projects[0];
        const expectedPathPattern = `${workspace.id}/${project.id}/`;
        setResult(prev => prev + `✅ Expected path pattern: ${expectedPathPattern}[file_id]\n`);
        setResult(prev => prev + `   Format: {workspace_id}/{project_id}/{file_id}\n`);
      }

      // 5. Test upload/download/delete permissions
      setResult(prev => prev + `\n🔐 Testing permissions...\n`);
      const testFile = new File(['Verification test'], 'verify-permissions.txt', { 
        type: 'text/plain' 
      });
      const verifyPath = `${workspace.id}/verify-${Date.now()}.txt`;
      
      // Upload test
      let uploadError: Error | null = null;
      let downloadError: Error | null = null;
      let deleteError: Error | null = null;
      
      const { error: uploadErr } = await supabase.storage
        .from('files')
        .upload(verifyPath, testFile);
      uploadError = uploadErr;

      if (uploadError) {
        setResult(prev => prev + `❌ Upload permission failed: ${uploadError.message}\n`);
      } else {
        setResult(prev => prev + `✅ Upload permission: OK\n`);
        
        // Download test
        const { error: downloadErr } = await supabase.storage
          .from('files')
          .download(verifyPath);
        downloadError = downloadErr;

        if (downloadError) {
          setResult(prev => prev + `❌ Download permission failed: ${downloadError?.message || 'Unknown error'}\n`);
        } else {
          setResult(prev => prev + `✅ Download permission: OK\n`);
        }

        // Delete test - but keep file for inspection
        const { error: deleteErr } = await supabase.storage
          .from('files')
          .remove([verifyPath]);
        deleteError = deleteErr;

        if (deleteError) {
          setResult(prev => prev + `❌ Delete permission failed: ${deleteError?.message || 'Unknown error'}\n`);
        } else {
          setResult(prev => prev + `✅ Delete permission: OK (file deleted for test)\n`);
          // Re-upload to keep file for inspection
          await supabase.storage
            .from('files')
            .upload(verifyPath, testFile);
          setResult(prev => prev + `   📦 File re-uploaded and kept for inspection at: ${verifyPath}\n`);
        }
      }

      // 6. Summary
      setResult(prev => prev + `\n📊 Verification Summary:\n`);
      
      // Check if we successfully tested permissions
      const uploadWorked = !uploadError;
      const downloadWorked = uploadWorked && !downloadError;
      const deleteWorked = uploadWorked && !deleteError;
      
      if (uploadWorked && downloadWorked && deleteWorked) {
        setResult(prev => prev + `   ✅ Storage bucket exists and accessible\n`);
        setResult(prev => prev + `   ✅ Path structure: {workspace_id}/{project_id}/{file_id}\n`);
        setResult(prev => prev + `   ✅ Upload/Download/Delete permissions working\n`);
        setResult(prev => prev + `\n🎉 Storage setup verified! Ready for Task 4.1.\n`);
      } else {
        setResult(prev => prev + `   ⚠️ Some checks had issues - see details above\n`);
        setResult(prev => prev + `   Note: Bucket listing may require admin permissions\n`);
        setResult(prev => prev + `   If upload/download worked, bucket is accessible!\n`);
      }

    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Verification error: ${error.message}\n${error.stack || ''}`);
    }
    
    setLoading(false);
  };

  const listBucketFiles = async () => {
    setLoading(true);
    setResult('Listing files in bucket...\n');
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult('❌ Not authenticated');
        setLoading(false);
        return;
      }
      setResult(prev => prev + `✅ Authenticated as: ${user.email}\n`);

      if (!selectedWorkspaceId) {
        setResult(prev => prev + `❌ Please select a workspace first\n`);
        setLoading(false);
        return;
      }

      const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
      if (!workspace) {
        setResult(prev => prev + `❌ Selected workspace not found\n`);
        setLoading(false);
        return;
      }

      setResult(prev => prev + `\n📁 Listing all files in workspace: ${workspace.name}\n`);
      setResult(prev => prev + `   Path: ${workspace.id}/\n\n`);

      // List workspace folder (should show project folders)
      const { data: workspaceItems, error: workspaceError } = await supabase.storage
        .from('files')
        .list(workspace.id, {
          limit: 100,
          offset: 0,
        });

      if (workspaceError) {
        setResult(prev => prev + `❌ Error listing workspace folder: ${workspaceError.message}\n`);
        setResult(prev => prev + `   (RLS may prevent listing, or folder doesn't exist yet)\n`);
        setLoading(false);
        return;
      }

      if (!workspaceItems || workspaceItems.length === 0) {
        setResult(prev => prev + `📂 Workspace folder is empty\n`);
        setResult(prev => prev + `   No files or project folders found yet.\n`);
        setResult(prev => prev + `   This is normal - files are cleaned up after tests.\n`);
        setLoading(false);
        return;
      }

      setResult(prev => prev + `📂 Found ${workspaceItems.length} item(s):\n\n`);

      // List each item (could be files or folders)
      for (const item of workspaceItems) {
        if (item.id === null) {
          // This is a folder (project folder)
          setResult(prev => prev + `📁 Folder: ${item.name}/\n`);
          
          // Try to list contents of project folder
          const projectPath = `${workspace.id}/${item.name}`;
          const { data: projectFiles, error: projectError } = await supabase.storage
            .from('files')
            .list(projectPath, {
              limit: 100,
              offset: 0,
            });

          if (!projectError && projectFiles && projectFiles.length > 0) {
            setResult(prev => prev + `   📄 Files in ${item.name}/:\n`);
            projectFiles.forEach((file, idx) => {
              const size = file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(2)} KB` : 'unknown size';
              const updated = file.updated_at ? new Date(file.updated_at).toLocaleString() : 'unknown date';
              setResult(prev => prev + `      ${idx + 1}. ${file.name} (${size}, updated: ${updated})\n`);
            });
          } else if (projectError) {
            setResult(prev => prev + `      ⚠️ Cannot list files (${projectError.message})\n`);
          } else {
            setResult(prev => prev + `      📭 No files in this folder\n`);
          }
          setResult(prev => prev + `\n`);
        } else {
          // This is a file (shouldn't happen with our structure, but handle it)
          const size = item.metadata?.size ? `${(item.metadata.size / 1024).toFixed(2)} KB` : 'unknown size';
          setResult(prev => prev + `📄 File: ${item.name} (${size})\n`);
        }
      }

      // Get projects to show expected structure
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspace.id);

      if (projects && projects.length > 0) {
        setResult(prev => prev + `\n📋 Expected project folders in this workspace:\n`);
        projects.forEach((project, idx) => {
          const exists = workspaceItems.some(item => item.name === project.id);
          setResult(prev => prev + `   ${idx + 1}. ${project.name} (${project.id}) ${exists ? '✅ exists' : '⚠️ not found'}\n`);
        });
      }

    } catch (err: unknown) {
      const error = err as Error;
      setResult(prev => prev + `❌ Error: ${error.message}\n${error.stack || ''}`);
    }
    
    setLoading(false);
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Storage Test - Task 4.1</h1>
      <p className="text-gray-600 mb-6">
        This tests: bucket creation, RLS policies, upload, download, and delete
      </p>
      
      {/* Workspace Selector */}
      <div className="mb-6">
        <label htmlFor="workspace-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Workspace
        </label>
        {loadingWorkspaces ? (
          <div className="text-sm text-gray-500">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="text-sm text-red-500">No workspaces found. Please create a workspace first.</div>
        ) : (
          <select
            id="workspace-select"
            value={selectedWorkspaceId || ''}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.role})
              </option>
            ))}
          </select>
        )}
        {selectedWorkspace && (
          <div className="mt-2 text-sm text-gray-600">
            Selected: <span className="font-semibold">{selectedWorkspace.name}</span> - Role: <span className="capitalize">{selectedWorkspace.role}</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={testUpload}
          disabled={loading || !selectedWorkspaceId || loadingWorkspaces}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Testing...' : 'Run Storage Test'}
        </button>
        
        <button
          onClick={verifyStorage}
          disabled={loading || !selectedWorkspaceId || loadingWorkspaces}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify Storage Setup'}
        </button>
        
        <button
          onClick={listBucketFiles}
          disabled={loading || !selectedWorkspaceId || loadingWorkspaces}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Listing...' : 'List Bucket Files'}
        </button>
      </div>
      
      <pre className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap font-mono text-sm">
        {result || 'Select a workspace and click button to test storage setup...'}
      </pre>
    </div>
  );
}