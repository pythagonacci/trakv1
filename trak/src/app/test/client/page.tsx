'use client'

import { useState } from 'react'
import { 
  createClient, 
  getAllClients, 
  getSingleClient, 
  updateClient, 
  deleteClient 
} from '@/app/actions/client'

export default function ClientTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [workspaceId, setWorkspaceId] = useState('')
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')

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

      <h1 className="text-3xl font-bold mb-8">Task 1.2: Client Management Tests</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-6">
          
          {/* 1. CREATE CLIENT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">1. Create Client</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Workspace ID"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Client Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border rounded"
                rows={3}
              />
              <button
                onClick={() => handleAction(() => createClient(workspaceId, {
                  name,
                  email: email || undefined,
                  company: company || undefined,
                  phone: phone || undefined,
                  address: address || undefined,
                  website: website || undefined,
                  notes: notes || undefined
                }))}
                disabled={loading || !workspaceId || !name}
                className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Client
              </button>
            </div>
          </section>

          {/* 2. GET ALL CLIENTS */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">2. Get All Clients</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Workspace ID"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => getAllClients(workspaceId))}
                disabled={loading || !workspaceId}
                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                Get All Clients
              </button>
            </div>
          </section>

          {/* 3. GET SINGLE CLIENT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">3. Get Single Client</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => getSingleClient(clientId))}
                disabled={loading || !clientId}
                className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                Get Client Details
              </button>
            </div>
          </section>

          {/* 4. UPDATE CLIENT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">4. Update Client</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
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
                type="email"
                placeholder="New Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="New Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <textarea
                placeholder="New Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border rounded"
                rows={2}
              />
              <button
                onClick={() => {
                  const updates: any = {}
                  if (name) updates.name = name
                  if (email) updates.email = email
                  if (company) updates.company = company
                  if (notes) updates.notes = notes
                  handleAction(() => updateClient(clientId, updates))
                }}
                disabled={loading || !clientId}
                className="w-full bg-yellow-600 text-white p-2 rounded hover:bg-yellow-700 disabled:bg-gray-300"
              >
                Update Client
              </button>
            </div>
          </section>

          {/* 5. DELETE CLIENT */}
          <section className="border p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">5. Delete Client</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleAction(() => deleteClient(clientId))}
                disabled={loading || !clientId}
                className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700 disabled:bg-gray-300"
              >
                Delete Client (Admin Only)
              </button>
              <p className="text-sm text-gray-600">
                ⚠️ Will fail if client has projects
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
          <p><strong>Tip:</strong> Get workspace ID from workspace tests first</p>
          <p><strong>Tip:</strong> Create a client, then copy its ID for update/delete/get single tests</p>
          <p><strong>Note:</strong> Project count will show 0 until Task 1.3 is complete</p>
          <p><strong>Permissions:</strong> Any member can create/view/update, only admin/owner can delete</p>
        </div>
      </div>
    </div>
  )
}