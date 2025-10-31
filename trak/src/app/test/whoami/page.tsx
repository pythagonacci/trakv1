'use client'

import { useState, useEffect } from 'react'
import { getMyInfo } from '@/app/actions/debug'

export default function WhoAmIPage() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadInfo() {
    setLoading(true)
    const result = await getMyInfo()
    setInfo(result)
    setLoading(false)
  }

  useEffect(() => {
    loadInfo()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <a href="/test" className="text-blue-600 hover:underline">← Back to Test Dashboard</a>
      </div>

      <h1 className="text-3xl font-bold mb-8">Who Am I? 🤔</h1>

      {loading ? (
        <p className="text-gray-600">Loading your info...</p>
      ) : info?.error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <p className="text-red-800 font-semibold">Error: {info.error}</p>
          <p className="text-red-600 text-sm mt-2">You might not be logged in. Check Supabase auth.</p>
        </div>
      ) : (
        <>
          {/* User Info */}
          <section className="border p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              👤 Your Account
            </h2>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <span className="font-semibold">User ID:</span>
                <span className="col-span-3 font-mono text-sm">{info.data.user.id}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <span className="font-semibold">Email:</span>
                <span className="col-span-3">{info.data.user.email}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <span className="font-semibold">Created:</span>
                <span className="col-span-3">{new Date(info.data.user.created_at).toLocaleString()}</span>
              </div>
            </div>
          </section>

          {/* Workspaces */}
          <section className="border p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              🏢 Your Workspaces ({info.data.total_workspaces})
            </h2>
            
            {info.data.workspaces.length === 0 ? (
              <p className="text-gray-600">You&apos;re not a member of any workspaces yet.</p>
            ) : (
              <div className="space-y-4">
                {info.data.workspaces.map((workspace: any, index: number) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{workspace.workspace_name}</h3>
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        workspace.your_role === 'owner' ? 'bg-purple-100 text-purple-800' :
                        workspace.your_role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {workspace.your_role.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-xs">
                          {workspace.workspace_id}
                        </span>
                        {workspace.is_owner && (
                          <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded text-xs">
                            👑 YOU OWN THIS
                          </span>
                        )}
                      </div>
                      <p>Joined: {new Date(workspace.joined_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="border p-6 rounded-lg bg-blue-50">
            <h2 className="text-xl font-semibold mb-4">📋 Quick Copy</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigator.clipboard.writeText(info.data.user.id)}
                className="block w-full text-left p-2 bg-white border rounded hover:bg-gray-50"
              >
                📋 Copy Your User ID
              </button>
              {info.data.workspaces.length > 0 && (
                <button
                  onClick={() => navigator.clipboard.writeText(info.data.workspaces[0].workspace_id)}
                  className="block w-full text-left p-2 bg-white border rounded hover:bg-gray-50"
                >
                  📋 Copy First Workspace ID
                </button>
              )}
            </div>
          </section>

          {/* Raw JSON */}
          <section className="mt-6">
            <details className="border p-4 rounded-lg">
              <summary className="cursor-pointer font-semibold">View Raw JSON</summary>
              <pre className="mt-4 text-sm overflow-auto bg-gray-50 p-4 rounded">
                {JSON.stringify(info.data, null, 2)}
              </pre>
            </details>
          </section>
        </>
      )}

      <button
        onClick={loadInfo}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        🔄 Refresh Info
      </button>
    </div>
  )
}