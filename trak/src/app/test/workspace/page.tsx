'use client'

import { createWorkspace, getUserWorkspaces, inviteMember, updateMemberRole, removeMember } from '@/app/actions/workspace'
import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('My Test Workspace')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'teammate'>('teammate')
  const [workspaceId, setWorkspaceId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [updateRole, setUpdateRole] = useState<'owner' | 'admin' | 'teammate'>('teammate')

  async function handleCreateWorkspace() {
    setLoading(true)
    const res = await createWorkspace(workspaceName)
    setResult(res)
    setLoading(false)
  }

  async function handleGetWorkspaces() {
    setLoading(true)
    const res = await getUserWorkspaces()
    setResult(res)
    setLoading(false)
  }

  async function handleInviteMember() {
    setLoading(true)
    const res = await inviteMember(workspaceId, inviteEmail, inviteRole)
    setResult(res)
    setLoading(false)
  }

  async function handleUpdateMemberRole() {
    setLoading(true)
    const res = await updateMemberRole(workspaceId, memberId, updateRole)
    setResult(res)
    setLoading(false)
  }

  async function handleRemoveMember() {
    setLoading(true)
    const res = await removeMember(workspaceId, memberId)
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Test: Workspace Actions</h1>
      
      {/* Create Workspace */}
      <div className="border p-4 rounded space-y-2">
        <h2 className="font-bold">Create Workspace</h2>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Workspace name"
        />
        <button 
          onClick={handleCreateWorkspace}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Workspace'}
        </button>
      </div>

      {/* Get Workspaces */}
      <div className="border p-4 rounded space-y-2">
        <h2 className="font-bold">Get Workspaces</h2>
        <button 
          onClick={handleGetWorkspaces}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Get Workspaces'}
        </button>
      </div>

      {/* Invite Member */}
      <div className="border p-4 rounded space-y-2">
        <h2 className="font-bold">Invite Member</h2>
        <input
          type="text"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Workspace ID"
        />
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Email to invite"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as 'admin' | 'teammate')}
          className="w-full px-4 py-2 border rounded"
        >
          <option value="teammate">Teammate</option>
          <option value="admin">Admin</option>
        </select>
        <button 
          onClick={handleInviteMember}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Inviting...' : 'Invite Member'}
        </button>
      </div>

      {/* Update Member Role */}
      <div className="border p-4 rounded space-y-2">
        <h2 className="font-bold">Update Member Role</h2>
        <input
          type="text"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Workspace ID"
        />
        <input
          type="text"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Member ID"
        />
        <select
          value={updateRole}
          onChange={(e) => setUpdateRole(e.target.value as 'owner' | 'admin' | 'teammate')}
          className="w-full px-4 py-2 border rounded"
        >
          <option value="teammate">Teammate</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <button 
          onClick={handleUpdateMemberRole}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Member Role'}
        </button>
      </div>

      {/* Remove Member */}
      <div className="border p-4 rounded space-y-2">
        <h2 className="font-bold">Remove Member</h2>
        <input
          type="text"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Workspace ID"
        />
        <input
          type="text"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Member ID"
        />
        <button 
          onClick={handleRemoveMember}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Removing...' : 'Remove Member'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div>
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}