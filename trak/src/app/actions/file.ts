'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

  // 4. Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 50MB limit' };
  }

  try {
    // 5. Generate unique file ID and construct storage path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

    // 6. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // 8. If blockId provided, attach file to block immediately
    if (blockId) {
      const attachResult = await attachFileToBlock(fileId, blockId, 'inline');
      if (attachResult.error) {
        // File uploaded but attachment failed - that's okay, return file
        console.error('File attachment failed:', attachResult.error);
      }
    }

    revalidatePath('/dashboard/projects');
    return { data: fileRecord };
  } catch (error: any) {
    return { error: error.message };
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
      console.error('Storage deletion failed:', storageError);
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
  } catch (error: any) {
    return { error: error.message };
  }
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

  // 4. Get signed URL (valid for 1 hour)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('files')
    .createSignedUrl(file.storage_path, 3600);

  if (urlError) {
    return { error: urlError.message };
  }

  return { data: { url: urlData.signedUrl } };
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
    .select('file_id, files(workspace_id)')
    .eq('id', attachmentId)
    .single();

  if (attachError || !attachment) {
    return { error: 'Attachment not found' };
  }

  // Verify workspace membership
  const workspaceId = (attachment.files as any).workspace_id;
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