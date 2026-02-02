'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * SECURITY: Allowed file types and extensions
 * Prevents upload of potentially dangerous files (executables, scripts, etc.)
 */
const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // Documents
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/msword': ['.doc'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  // Videos
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/ogg': ['.ogg'],
  'video/quicktime': ['.mov'],
  // Audio
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  // Archives
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  // CSV
  'text/csv': ['.csv'],
};

/**
 * SECURITY: Blocked file extensions (executable, script, potentially dangerous files)
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jse',
  '.msi', '.msp', '.hta', '.cpl', '.jar', '.sh', '.bash', '.ps1', '.psm1',
  '.dll', '.sys', '.drv', '.app', '.deb', '.rpm', '.dmg', '.pkg'
];

/**
 * Validate file type and extension
 * Returns error message if file is not allowed, null if valid
 */
function validateFileType(file: File): string | null {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  const extension = '.' + (fileName.split('.').pop() || '');

  // SECURITY: Block dangerous extensions
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return `File type not allowed: ${extension}. Executable and script files are blocked for security.`;
  }

  // Check if file type is in allowed list
  const allowedExtensions = ALLOWED_FILE_TYPES[fileType as keyof typeof ALLOWED_FILE_TYPES];

  if (!allowedExtensions) {
    // If MIME type is not in allowed list, check if extension matches any allowed extension
    const allAllowedExtensions = Object.values(ALLOWED_FILE_TYPES).flat();
    if (!allAllowedExtensions.includes(extension)) {
      return `File type not supported: ${extension}. Please upload images, documents, videos, or archives only.`;
    }
  }

  return null; // File is valid
}

/**
 * Upload file to Supabase Storage and create database record
 * Returns file object with storage path and metadata
 */
export async function uploadFile(
  formData: FormData,
  workspaceId: string,
  projectId: string,
  blockId?: string // Optional: if we want to attach immediately
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized to upload to this workspace' };
  }

  // 3. Get file from FormData
  const file = formData.get('file') as File;
  if (!file) {
    return { error: 'No file provided' };
  }

  // 4. SECURITY: Validate file type
  const validationError = validateFileType(file);
  if (validationError) {
    return { error: validationError };
  }

  // 5. Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 50MB limit' };
  }

  try {
    // 6. Generate unique file ID and construct storage path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 7. Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up: delete uploaded file if DB insert fails
      await supabase.storage.from('files').remove([storagePath]);
      return { error: `Database error: ${dbError.message}` };
    }

    // 7. If blockId provided, attach file to block immediately
    if (blockId) {
      const attachResult = await attachFileToBlock(fileId, blockId, 'inline');
      if (attachResult.error) {
        // File uploaded but attachment failed - that's okay, return file
        logger.error('File attachment failed:', attachResult.error);
      }
    }

    revalidatePath('/dashboard/projects');
    return { data: fileRecord };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * Attach an existing file to a block
 */
export async function attachFileToBlock(
  fileId: string,
  blockId: string,
  displayMode: 'inline' | 'linked' = 'inline'
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify file exists and user has access
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, workspace_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. Create file attachment
  const { data: attachment, error: attachError } = await supabase
    .from('file_attachments')
    .insert({
      file_id: fileId,
      block_id: blockId,
      display_mode: displayMode,
    })
    .select()
    .single();

  if (attachError) {
    return { error: attachError.message };
  }

  revalidatePath('/dashboard/projects');
  return { data: attachment };
}

/**
 * Get all files attached to a block
 */
export async function getBlockFiles(blockId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: files, error } = await supabase
    .from('file_attachments')
    .select(
      `
      id,
      display_mode,
      file:files (
        id,
        file_name,
        file_size,
        file_type,
        storage_path,
        created_at
      )
    `
    )
    .eq('block_id', blockId);

  if (error) {
    return { error: error.message };
  }

  return { data: files };
}

/**
 * Delete a file from storage and database
 */
export async function deleteFile(fileId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get file details
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, workspace_id, storage_path, uploaded_by')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Check permissions: user is uploader OR admin/owner of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  const isUploader = file.uploaded_by === user.id;
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

  if (!isUploader && !isAdmin) {
    return { error: 'Not authorized to delete this file' };
  }

  try {
    // 4. Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path]);

    if (storageError) {
      logger.error('Storage deletion failed:', storageError);
      // Continue anyway - file might already be deleted
    }

    // 5. Delete from database (cascades to file_attachments)
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      return { error: `Database error: ${dbError.message}` };
    }

    revalidatePath('/dashboard/projects');
    return { data: { success: true } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * Rename a file (display name only)
 */
export async function renameFile(fileId: string, fileName: string, opts?: { authContext?: import("@/lib/auth-context").AuthContext }) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  // 2. Get file details
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, workspace_id, uploaded_by')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Check permissions: uploader OR admin/owner of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', userId)
    .single();

  const isUploader = file.uploaded_by === userId;
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

  if (!isUploader && !isAdmin) {
    return { error: 'Not authorized to rename this file' };
  }

  const trimmedName = fileName?.trim();
  if (!trimmedName) {
    return { error: 'File name cannot be empty' };
  }

  const { data: updated, error: updateError } = await supabase
    .from('files')
    .update({ file_name: trimmedName })
    .eq('id', fileId)
    .select('id, file_name')
    .single();

  if (updateError || !updated) {
    return { error: 'Failed to rename file' };
  }

  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard/internal');
  return { data: updated };
}

/**
 * Get download URL for a file
 */
export async function getFileUrl(fileId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get file details
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('storage_path, workspace_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Verify user has access to workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. SECURITY: Get signed URL (valid for 5 minutes)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('files')
    .createSignedUrl(file.storage_path, 300);

  if (urlError) {
    return { error: urlError.message };
  }

  return { data: { url: urlData.signedUrl } };
}

/**
 * Get download URLs for multiple files in a single batched request
 * Reduces database queries from 3N to 2 (where N = number of files)
 */
export async function getBatchFileUrls(fileIds: string[]) {
  'use server';

  if (!fileIds || fileIds.length === 0) {
    return { data: {} };
  }

  // Remove duplicates
  const uniqueFileIds = Array.from(new Set(fileIds));

  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', data: {} };
  }

  // 2. Fetch ALL files in ONE query
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, storage_path, workspace_id')
    .in('id', uniqueFileIds);

  if (filesError || !files || files.length === 0) {
    return { data: {} };
  }

  // 3. Get workspace ID (assume all files in same workspace for this tab)
  const workspaceId = files[0].workspace_id;

  // 4. ONE membership check for the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'No workspace access', data: {} };
  }

  // 5. Generate ALL signed URLs in PARALLEL
  const urlPromises = files.map(async (file) => {
    try {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('files')
        .createSignedUrl(file.storage_path, 300); // SECURITY: 5 minute expiry

      if (urlError) {
        logger.error(`Failed to generate signed URL for file ${file.id}:`, urlError);
        return {
          fileId: file.id,
          url: null,
        };
      }

      return {
        fileId: file.id,
        url: urlData?.signedUrl || null,
      };
    } catch (error) {
      logger.error(`Error generating signed URL for file ${file.id}:`, error);
      return {
        fileId: file.id,
        url: null,
      };
    }
  });

  const urlResults = await Promise.all(urlPromises);

  // 6. Return as map: { fileId: signedUrl }
  const urlMap: Record<string, string> = {};
  urlResults.forEach(result => {
    if (result.url) {
      urlMap[result.fileId] = result.url;
    }
  });

  logger.log(`📦 Batch fetched ${Object.keys(urlMap).length} file URLs`);

  return { data: urlMap };
}

/**
 * Batch fetch file URLs for public client pages
 * Uses service role client to bypass RLS
 */
export async function getBatchFileUrlsPublic(fileIds: string[], publicToken: string) {
  'use server';
  
  if (!fileIds || fileIds.length === 0) {
    return { data: {} };
  }

  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = await createServiceClient();

  try {
    // 1. Verify public token
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled")
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError || !project) {
      return { error: 'Invalid public token', data: {} };
    }

    // 2. Remove duplicates
    const uniqueFileIds = Array.from(new Set(fileIds));

    // 3. Fetch all files (verify they belong to the project's workspace)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, storage_path, workspace_id')
      .in('id', uniqueFileIds)
      .eq('workspace_id', project.workspace_id);

    if (filesError || !files || files.length === 0) {
      return { data: {} };
    }

    // 4. Generate signed URLs in parallel
    const urlPromises = files.map(async (file) => {
      try {
        const { data: urlData } = await supabase.storage
          .from('files')
          .createSignedUrl(file.storage_path, 300); // SECURITY: 5 minute expiry

        return {
          fileId: file.id,
          url: urlData?.signedUrl || null
        };
      } catch (error) {
        logger.error(`Failed to generate URL for file ${file.id}:`, error);
        return { fileId: file.id, url: null };
      }
    });

    const urlResults = await Promise.all(urlPromises);

    // 5. Return as map
    const urlMap: Record<string, string> = {};
    urlResults.forEach(result => {
      if (result.url) {
        urlMap[result.fileId] = result.url;
      }
    });

    logger.log(`📦 Public: Batch fetched ${Object.keys(urlMap).length} file URLs`);

    return { data: urlMap };
  } catch (error) {
    logger.error('Get batch file URLs public exception:', error);
    return { error: 'Failed to fetch file URLs', data: {} };
  }
}

/**
 * Detach file from block (doesn't delete the file, just the attachment)
 */
export async function detachFileFromBlock(attachmentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get attachment to verify permissions
  const { data: attachment, error: attachError } = await supabase
    .from('file_attachments')
    .select('file_id, files!inner(workspace_id)')
    .eq('id', attachmentId)
    .single();

  if (attachError || !attachment) {
    return { error: 'Attachment not found' };
  }

  // Verify workspace membership
  const files = attachment.files as { workspace_id: string } | { workspace_id: string }[];
  const workspaceId = Array.isArray(files) ? files[0]?.workspace_id : files.workspace_id;
  
  if (!workspaceId) {
    return { error: 'Workspace not found' };
  }
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // Delete attachment
  const { error: deleteError } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath('/dashboard/projects');
  return { data: { success: true } };
}

/**
 * Create file record after storage upload (used by client-side upload)
 * This is called after the file is uploaded to Supabase Storage via client-side
 */
export async function createFileRecord(data: {
  fileId: string;
  workspaceId: string;
  projectId: string;
  blockId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
}) {
  const supabase = await createClient();

  // 1. Validate authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Validate workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', data.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized to upload to this workspace' };
  }

  // 3. Normalize file type (fallback to extension-based detection if missing)
  let fileType = data.fileType;
  if (!fileType || fileType === 'application/octet-stream' || fileType === '') {
    // Detect file type from extension
    const extension = data.fileName.split('.').pop()?.toLowerCase() || '';
    const extensionMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
    };
    fileType = extensionMap[extension] || `application/octet-stream`;
    logger.log(`🔧 Normalized file type for ${data.fileName}: ${data.fileType} -> ${fileType}`);
  }

  // 3. Create file record
  const { data: fileRecord, error: dbError } = await supabase
    .from('files')
    .insert({
      id: data.fileId,
      workspace_id: data.workspaceId,
      project_id: data.projectId,
      uploaded_by: user.id,
      file_name: data.fileName,
      file_size: data.fileSize,
      file_type: fileType,
      storage_path: data.storagePath,
    })
    .select()
    .single();

  if (dbError) {
    return { error: `Database error: ${dbError.message}` };
  }

  // 4. Attach to block only if blockId is provided (for standalone files, blockId is empty)
  if (data.blockId) {
    const { error: attachError } = await supabase
      .from('file_attachments')
      .insert({
        file_id: data.fileId,
        block_id: data.blockId,
        display_mode: 'inline',
      });

    if (attachError) {
      // File created but attachment failed - still return success
      logger.error('Attachment failed:', attachError);
    }
  }

  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard/internal');
  return { data: fileRecord };
}

/**
 * Upload file without attaching to a block (standalone file)
 */
export async function uploadStandaloneFile(
  formData: FormData,
  workspaceId: string,
  projectId: string
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized to upload to this workspace' };
  }

  // 3. Get file from FormData
  const file = formData.get('file') as File;
  if (!file) {
    return { error: 'No file provided' };
  }

  // 4. SECURITY: Validate file type
  const validationError = validateFileType(file);
  if (validationError) {
    return { error: validationError };
  }

  // 5. Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 50MB limit' };
  }

  try {
    // 6. Generate unique file ID and construct storage path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 7. Create file record in database (without block attachment)
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up: delete uploaded file if DB insert fails
      await supabase.storage.from('files').remove([storagePath]);
      return { error: `Database error: ${dbError.message}` };
    }

    revalidatePath('/dashboard/internal');
    revalidatePath(`/dashboard/internal/${projectId}`);
    return { data: fileRecord };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * Get all standalone files for a project (files not attached to blocks)
 */
export async function getProjectFiles(projectId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get project to verify workspace access
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { error: 'Project not found' };
  }

  // 3. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. Get all files for this project that are NOT attached to any block
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select(`
      id,
      file_name,
      file_size,
      file_type,
      storage_path,
      created_at,
      uploaded_by
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filesError) {
    return { error: filesError.message };
  }

  // 5. Filter out files that are attached to blocks
  const { data: attachments, error: attachmentsError } = await supabase
    .from('file_attachments')
    .select('file_id')
    .in('file_id', files?.map(f => f.id) || []);

  if (attachmentsError) {
    // If we can't check attachments, return all files (safer)
    return { data: files || [] };
  }

  const attachedFileIds = new Set((attachments || []).map(a => a.file_id));
  const standaloneFiles = (files || []).filter(f => !attachedFileIds.has(f.id));

  return { data: standaloneFiles };
}

/**
 * Get all standalone files for a workspace (from all internal spaces)
 */
export async function getWorkspaceStandaloneFiles(workspaceId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 3. Get all internal spaces for this workspace
  const { data: internalSpaces, error: spacesError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('project_type', 'internal');

  if (spacesError) {
    return { error: spacesError.message };
  }

  if (!internalSpaces || internalSpaces.length === 0) {
    return { data: [] };
  }

  const spaceIds = internalSpaces.map(s => s.id);

  // 4. Get all files from internal spaces that are NOT attached to any block
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select(`
      id,
      file_name,
      file_size,
      file_type,
      storage_path,
      created_at,
      uploaded_by,
      project_id
    `)
    .in('project_id', spaceIds)
    .order('created_at', { ascending: false });

  if (filesError) {
    return { error: filesError.message };
  }

  if (!files || files.length === 0) {
    return { data: [] };
  }

  // 5. Filter out files that are attached to blocks
  const { data: attachments, error: attachmentsError } = await supabase
    .from('file_attachments')
    .select('file_id')
    .in('file_id', files.map(f => f.id));

  if (attachmentsError) {
    // If we can't check attachments, return all files (safer)
    return { data: files };
  }

  const attachedFileIds = new Set((attachments || []).map(a => a.file_id));
  const standaloneFiles = files.filter(f => !attachedFileIds.has(f.id));

  return { data: standaloneFiles };
}
