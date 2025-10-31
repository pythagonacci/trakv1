"use client";

import { useState } from "react";
import {
  createTab,
  getProjectTabs,
  updateTab,
  reorderTabs,
  deleteTab,
  type TabWithChildren,
} from "@/app/actions/tab";

export default function TabTestPage() {
  const [projectId, setProjectId] = useState("");
  const [tabName, setTabName] = useState("");
  const [parentTabId, setParentTabId] = useState("");
  const [tabs, setTabs] = useState<TabWithChildren[]>([]);
  const [selectedTabId, setSelectedTabId] = useState("");
  const [newName, setNewName] = useState("");
  const [reorderIds, setReorderIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Test 1: Create Tab
  const handleCreateTab = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await createTab({
        projectId,
        name: tabName,
        parentTabId: parentTabId || null,
      });
      setResult(res);
      if (res.data) {
        alert("✅ Tab created successfully!");
      } else {
        alert("❌ Error: " + res.error);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Test 2: Get Project Tabs
  const handleGetTabs = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await getProjectTabs(projectId);
      setResult(res);
      if (res.data) {
        setTabs(res.data);
        alert(`✅ Found ${res.data.length} top-level tabs`);
      } else {
        alert("❌ Error: " + res.error);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Test 3: Update Tab
  const handleUpdateTab = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await updateTab({
        tabId: selectedTabId,
        name: newName,
      });
      setResult(res);
      if (res.data) {
        alert("✅ Tab updated successfully!");
      } else {
        alert("❌ Error: " + res.error);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Test 4: Reorder Tabs
  const handleReorderTabs = async () => {
    setLoading(true);
    setResult(null);
    try {
      const tabIds = reorderIds.split(",").map((id) => id.trim());
      const res = await reorderTabs({
        tabIds,
        projectId,
        parentTabId: null, // For top-level tabs
      });
      setResult(res);
      if (res.data) {
        alert("✅ Tabs reordered successfully!");
      } else {
        alert("❌ Error: " + res.error);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Test 5: Delete Tab
  const handleDeleteTab = async () => {
    if (!confirm("Are you sure? This will cascade delete all sub-tabs and blocks!")) {
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await deleteTab(selectedTabId);
      setResult(res);
      if (res.data) {
        alert(`✅ Deleted ${res.data.deletedCount} tab(s) successfully!`);
      } else {
        alert("❌ Error: " + res.error);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Render tab tree recursively
  const renderTabTree = (tabList: TabWithChildren[], depth = 0) => {
    return tabList.map((tab) => (
      <div key={tab.id} style={{ marginLeft: depth * 20 }}>
        <div className="border p-2 mb-2 rounded">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-500">
              {tab.id.slice(0, 8)}
            </span>
            <span className="font-semibold">{tab.name}</span>
            <span className="text-xs text-gray-500">pos: {tab.position}</span>
            {tab.parent_tab_id && (
              <span className="text-xs text-blue-500">
                parent: {tab.parent_tab_id.slice(0, 8)}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedTabId(tab.id);
                setNewName(tab.name);
              }}
              className="ml-auto text-xs px-2 py-1 bg-blue-100 rounded"
            >
              Select
            </button>
          </div>
          {tab.children && tab.children.length > 0 && (
            <div className="mt-2">{renderTabTree(tab.children, depth + 1)}</div>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Tab Actions Test Page</h1>

      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm">
          <strong>Instructions:</strong>
          <br />
          1. First, get a project ID from /test/project
          <br />
          2. Create some tabs to test with
          <br />
          3. Test the hierarchy by creating sub-tabs (use parent tab ID)
          <br />
          4. Use Get Tabs to see the nested structure
        </p>
      </div>

      {/* Global Inputs */}
      <div className="mb-8 grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Enter project ID"
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Actions */}
        <div className="space-y-6">
          {/* Test 1: Create Tab */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">1. Create Tab</h2>
            <div className="space-y-2">
              <input
                type="text"
                value={tabName}
                onChange={(e) => setTabName(e.target.value)}
                placeholder="Tab name"
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="text"
                value={parentTabId}
                onChange={(e) => setParentTabId(e.target.value)}
                placeholder="Parent tab ID (optional, leave empty for top-level)"
                className="w-full px-3 py-2 border rounded"
              />
              <button
                onClick={handleCreateTab}
                disabled={loading || !projectId || !tabName}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Tab
              </button>
            </div>
          </div>

          {/* Test 2: Get Tabs */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">2. Get Project Tabs</h2>
            <button
              onClick={handleGetTabs}
              disabled={loading || !projectId}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
            >
              Get Tabs (with hierarchy)
            </button>
          </div>

          {/* Test 3: Update Tab */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">3. Update Tab</h2>
            <div className="space-y-2">
              <input
                type="text"
                value={selectedTabId}
                onChange={(e) => setSelectedTabId(e.target.value)}
                placeholder="Tab ID (or click Select button)"
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New name"
                className="w-full px-3 py-2 border rounded"
              />
              <button
                onClick={handleUpdateTab}
                disabled={loading || !selectedTabId || !newName}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                Update Tab Name
              </button>
            </div>
          </div>

          {/* Test 4: Reorder Tabs */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">4. Reorder Tabs</h2>
            <div className="space-y-2">
              <input
                type="text"
                value={reorderIds}
                onChange={(e) => setReorderIds(e.target.value)}
                placeholder="Tab IDs separated by commas (e.g., id1,id2,id3)"
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-600">
                Note: Only reorders tabs at the same level (same parent)
              </p>
              <button
                onClick={handleReorderTabs}
                disabled={loading || !projectId || !reorderIds}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-300"
              >
                Reorder Tabs
              </button>
            </div>
          </div>

          {/* Test 5: Delete Tab */}
          <div className="border p-4 rounded-lg border-red-300">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              5. Delete Tab
            </h2>
            <div className="space-y-2">
              <input
                type="text"
                value={selectedTabId}
                onChange={(e) => setSelectedTabId(e.target.value)}
                placeholder="Tab ID (or click Select button)"
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-red-600">
                ⚠️ Warning: Cascade deletes all sub-tabs and blocks!
              </p>
              <button
                onClick={handleDeleteTab}
                disabled={loading || !selectedTabId}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300"
              >
                Delete Tab
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Tab Tree */}
        <div className="space-y-6">
          {/* Tab Tree Visualization */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Tab Tree</h2>
            {tabs.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {renderTabTree(tabs)}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Click "Get Tabs" to load tabs
              </p>
            )}
          </div>

          {/* Result Display */}
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            {loading && <p className="text-blue-600">Loading...</p>}
            {result && (
              <pre className="bg-gray-50 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}