'use client'

import { useState } from 'react'
import { 
  createProject, 
  getAllProjects, 
  getSingleProject, 
  updateProject, 
  deleteProject 
} from '@/app/actions/project'

export default function ProjectTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'complete'>('not_started')
  const [dueDateDate, setDueDateDate] = useState('')
  const [dueDateText, setDueDateText] = useState('')
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Helper to handle async actions
  async function handleAction(action: () => Promise<any>) {
    setLoading(true)
    try {
      const res = await action()
      setResult(res)
    } catch (error) {
      setResult({ error: String(error) })
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <a href="/test" className="text-blue-600 hover:underline">← Back to Test Dashboard</a>
      </div>

      <h1 className="text-3xl font-bold mb-8">Task 1.3: Project Management Tests</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-6">
          
          {/* 1. CREATE PROJECT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">1. Create Project</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Workspace ID *"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Client ID (optional)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Project Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
              <input
                type="date"
                placeholder="Due Date (date)"
                value={dueDateDate}
                onChange={(e) => setDueDateDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Due Date (text) e.g., 'End of Q3'"
                value={dueDateText}
                onChange={(e) => setDueDateText(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => createProject(workspaceId, {
                  name,
                  client_id: clientId || null,
                  status,
                  due_date_date: dueDateDate || null,
                  due_date_text: dueDateText || null
                }))}
                disabled={loading || !workspaceId || !name}
                className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Project
              </button>
            </div>
          </section>

          {/* 2. GET ALL PROJECTS */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">2. Get All Projects</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Workspace ID *"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-semibold mb-2">Filters (optional):</p>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                >
                  <option value="">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter by Client ID"
                  value={filterClientId}
                  onChange={(e) => setFilterClientId(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="created_at">Sort by Created</option>
                    <option value="updated_at">Sort by Updated</option>
                    <option value="due_date_date">Sort by Due Date</option>
                    <option value="name">Sort by Name</option>
                  </select>

                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleAction(() => getAllProjects(workspaceId, {
                  status: filterStatus as any || undefined,
                  client_id: filterClientId || undefined,
                  sort_by: sortBy as any,
                  sort_order: sortOrder as any
                }))}
                disabled={loading || !workspaceId}
                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                Get All Projects
              </button>
            </div>
          </section>

          {/* 3. GET SINGLE PROJECT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">3. Get Single Project</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project ID"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => getSingleProject(projectId))}
                disabled={loading || !projectId}
                className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                Get Project Details
              </button>
            </div>
          </section>

          {/* 4. UPDATE PROJECT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">4. Update Project</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project ID *"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="New Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="New Client ID (or empty to remove)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="">Don't change status</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
              <input
                type="date"
                placeholder="New Due Date (date)"
                value={dueDateDate}
                onChange={(e) => setDueDateDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="New Due Date (text)"
                value={dueDateText}
                onChange={(e) => setDueDateText(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => {
                  const updates: any = {}
                  if (name) updates.name = name
                  if (clientId !== undefined) updates.client_id = clientId || null
                  if (status) updates.status = status
                  if (dueDateDate) updates.due_date_date = dueDateDate
                  if (dueDateText) updates.due_date_text = dueDateText
                  handleAction(() => updateProject(projectId, updates))
                }}
                disabled={loading || !projectId}
                className="w-full bg-yellow-600 text-white p-2 rounded hover:bg-yellow-700 disabled:bg-gray-300"
              >
                Update Project
              </button>
            </div>
          </section>

          {/* 5. DELETE PROJECT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">5. Delete Project</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project ID"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => deleteProject(projectId))}
                disabled={loading || !projectId}
                className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700 disabled:bg-gray-300"
              >
                Delete Project (Admin Only)
              </button>
              <p className="text-sm text-gray-600">
                ⚠️ Only admins and owners can delete projects
              </p>
            </div>
          </section>

        </div>

        {/* Right Column - Results */}
        <div>
          <div className="sticky top-8">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            <div className="border p-4 rounded-lg bg-gray-50">
              {loading ? (
                <p className="text-gray-600">Loading...</p>
              ) : result ? (
                <pre className="text-sm overflow-auto max-h-[800px]">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <p className="text-gray-400">No results yet. Run a test to see output.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="mt-8 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Reference</h2>
        <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
          <p><strong>Tip:</strong> Get workspace ID and client ID from previous tests</p>
          <p><strong>Tip:</strong> Create a project, then copy its ID for update/delete/get tests</p>
          <p><strong>Status Options:</strong> not_started, in_progress, complete</p>
          <p><strong>Due Dates:</strong> You can use date, text, or both!</p>
          <p><strong>Permissions:</strong> Any member can create/view/update, only admin/owner can delete</p>
          <p><strong>Client Linking:</strong> Projects can exist without a client (leave client ID empty)</p>
        </div>
      </div>
    </div>
  )
}