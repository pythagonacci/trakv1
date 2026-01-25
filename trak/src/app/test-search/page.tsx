"use client";

import { useState } from "react";
import {
  searchAll,
  searchTasks,
  searchDocs,
  searchDocContent,
  searchDocsContentAll,
  searchProjects,
  searchClients,
  searchWorkspaceMembers,
  searchTabs,
  searchBlocks,
  searchTables,
  searchTableFields,
  searchTableViews,
  searchTableRows,
  searchTimelineEvents,
  searchFiles,
  searchComments,
  searchTaskComments,
  searchPayments,
  searchTags,
  searchPropertyDefinitions,
  searchEntityLinks,
  searchEntityProperties,
  getEntityById,
  getEntityContext,
  getEntityContextById,
  getTableSchema,
  resolveTableFieldByName,
  queryTableRowsByFieldNames,
  resolveEntityByName,
} from "@/app/actions/ai-search";

type TestFunction =
  | "searchAll"
  | "searchTasks"
  | "searchDocs"
  | "searchDocContent"
  | "searchDocsContentAll"
  | "searchProjects"
  | "searchClients"
  | "searchWorkspaceMembers"
  | "searchTabs"
  | "searchBlocks"
  | "searchTables"
  | "searchTableFields"
  | "searchTableViews"
  | "searchTableRows"
  | "searchTimelineEvents"
  | "searchFiles"
  | "searchComments"
  | "searchTaskComments"
  | "searchPayments"
  | "searchTags"
  | "searchPropertyDefinitions"
  | "searchEntityLinks"
  | "searchEntityProperties"
  | "resolveEntityByName"
  | "getEntityById"
  | "getEntityContext"
  | "getEntityContextById"
  | "getTableSchema"
  | "resolveTableFieldByName"
  | "queryTableRowsByFieldNames";

export default function TestSearchPage() {
  const [selectedTest, setSelectedTest] = useState<TestFunction>("searchAll");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Additional params
  const [entityType, setEntityType] = useState("task");
  const [entityId, setEntityId] = useState("");
  const [tableId, setTableId] = useState("");
  const [docId, setDocId] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [tagName, setTagName] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(20);
  const [extraParams, setExtraParams] = useState("{}");

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      let result: any;
      let parsedExtra: Record<string, unknown> = {};

      if (extraParams.trim()) {
        try {
          parsedExtra = JSON.parse(extraParams);
        } catch (err: any) {
          throw new Error(`Invalid JSON in Extra Params: ${err.message}`);
        }
      }

      const baseParams = {
        searchText: searchText || undefined,
        limit,
      };

      switch (selectedTest) {
        case "searchAll":
          result = await searchAll({
            searchText,
            includeContent,
            limit,
            ...parsedExtra,
          });
          break;

        case "searchTasks":
          result = await searchTasks({
            searchText: searchText || undefined,
            assigneeName: assigneeName || undefined,
            tagName: tagName || undefined,
            status: status || undefined,
            limit,
            ...parsedExtra,
          });
          break;

        case "searchDocs":
          result = await searchDocs({
            searchText: searchText || undefined,
            searchBoth: includeContent,
            limit,
            ...parsedExtra,
          });
          break;

        case "searchDocContent":
          result = await searchDocContent({
            docId,
            searchText,
            ...parsedExtra,
          });
          break;

        case "searchDocsContentAll":
          result = await searchDocsContentAll({
            searchText,
            limit,
            ...parsedExtra,
          });
          break;

        case "searchProjects":
          result = await searchProjects({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchClients":
          result = await searchClients({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchWorkspaceMembers":
          result = await searchWorkspaceMembers({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchTabs":
          result = await searchTabs({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchBlocks":
          result = await searchBlocks({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchTables":
          result = await searchTables({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchTableFields":
          result = await searchTableFields({
            ...baseParams,
            tableId: tableId || undefined,
            ...parsedExtra,
          });
          break;

        case "searchTableViews":
          result = await searchTableViews({
            ...baseParams,
            tableId: tableId || undefined,
            ...parsedExtra,
          });
          break;

        case "searchTableRows":
          result = await searchTableRows({
            ...baseParams,
            tableId: tableId || undefined,
            ...parsedExtra,
          });
          break;

        case "searchTimelineEvents":
          result = await searchTimelineEvents({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchFiles":
          result = await searchFiles({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchComments":
          result = await searchComments({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchTaskComments":
          result = await searchTaskComments({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchPayments":
          result = await searchPayments({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchTags":
          result = await searchTags({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchPropertyDefinitions":
          result = await searchPropertyDefinitions({
            ...baseParams,
            ...parsedExtra,
          });
          break;

        case "searchEntityLinks":
          result = await searchEntityLinks({
            limit,
            ...parsedExtra,
          });
          break;

        case "searchEntityProperties":
          result = await searchEntityProperties({
            limit,
            ...parsedExtra,
          });
          break;

        case "resolveEntityByName":
          result = await resolveEntityByName({
            entityType: entityType as any,
            name: searchText,
            limit: 10,
            ...parsedExtra,
          });
          break;

        case "getEntityById":
          result = await getEntityById({
            entityType: entityType as any,
            id: entityId,
            ...parsedExtra,
          });
          break;

        case "getEntityContext":
          result = await getEntityContext({
            entityType: entityType as any,
            id: entityId,
            ...parsedExtra,
          });
          break;

        case "getEntityContextById":
          result = await getEntityContextById({
            entityType: entityType as any,
            id: entityId,
            ...parsedExtra,
          });
          break;

        case "getTableSchema":
          result = await getTableSchema({
            tableId,
            ...parsedExtra,
          });
          break;

        case "resolveTableFieldByName":
          result = await resolveTableFieldByName({
            tableId,
            fieldName,
            ...parsedExtra,
          });
          break;

        case "queryTableRowsByFieldNames":
          result = await queryTableRowsByFieldNames({
            tableId,
            searchText: searchText || undefined,
            limit,
            ...parsedExtra,
          });
          break;

        default:
          throw new Error("Unknown test function");
      }

      setResults(result);

      if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderResults = () => {
    if (!results) return null;

    const data = results.data;
    const hasMore = results.hasMore;
    const totalCount = results.totalCount;

    return (
      <div className="mt-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Results {data && `(${data.length})`}
            </h3>
            {totalCount !== undefined && (
              <div className="text-sm text-gray-500">
                Total: {totalCount} | Has More: {hasMore ? "Yes" : "No"}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              ❌ {error}
            </div>
          )}

          {!data || data.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No results found
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {data.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="border rounded p-3 hover:bg-gray-50 transition-colors"
                >
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(item, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">AI Search Testing</h1>
        <p className="text-gray-600 mb-8">
          Test the new search functions with your existing data
        </p>

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Test Function Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select Test Function
            </label>
            <select
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value as TestFunction)}
              className="w-full border rounded px-3 py-2"
            >
              <optgroup label="Search Functions">
                <option value="searchAll">searchAll (Universal Search)</option>
                <option value="searchTasks">searchTasks</option>
                <option value="searchDocs">searchDocs</option>
                <option value="searchDocContent">searchDocContent</option>
                <option value="searchDocsContentAll">searchDocsContentAll</option>
                <option value="searchProjects">searchProjects</option>
                <option value="searchClients">searchClients</option>
                <option value="searchWorkspaceMembers">searchWorkspaceMembers</option>
                <option value="searchTabs">searchTabs</option>
                <option value="searchBlocks">searchBlocks</option>
                <option value="searchTables">searchTables</option>
                <option value="searchTableFields">searchTableFields</option>
                <option value="searchTableViews">searchTableViews</option>
                <option value="searchTableRows">searchTableRows</option>
                <option value="searchTimelineEvents">searchTimelineEvents</option>
                <option value="searchFiles">searchFiles</option>
                <option value="searchComments">searchComments</option>
                <option value="searchTaskComments">searchTaskComments</option>
                <option value="searchPayments">searchPayments</option>
                <option value="searchTags">searchTags</option>
                <option value="searchPropertyDefinitions">searchPropertyDefinitions</option>
                <option value="searchEntityLinks">searchEntityLinks</option>
                <option value="searchEntityProperties">searchEntityProperties</option>
              </optgroup>
              <optgroup label="Resolution Functions">
                <option value="resolveEntityByName">resolveEntityByName</option>
              </optgroup>
              <optgroup label="Entity Primitives">
                <option value="getEntityById">getEntityById</option>
                <option value="getEntityContext">getEntityContext</option>
                <option value="getEntityContextById">getEntityContextById</option>
                <option value="getTableSchema">getTableSchema</option>
                <option value="resolveTableFieldByName">resolveTableFieldByName</option>
                <option value="queryTableRowsByFieldNames">queryTableRowsByFieldNames</option>
              </optgroup>
            </select>
          </div>

          {/* Common Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Search Text */}
            {[
              "searchAll",
              "searchTasks",
              "searchDocs",
              "searchDocContent",
              "searchDocsContentAll",
              "searchProjects",
              "searchClients",
              "searchWorkspaceMembers",
              "searchTabs",
              "searchBlocks",
              "searchTables",
              "searchTableFields",
              "searchTableViews",
              "searchTableRows",
              "searchTimelineEvents",
              "searchFiles",
              "searchComments",
              "searchTaskComments",
              "searchPayments",
              "searchTags",
              "searchPropertyDefinitions",
              "searchEntityLinks",
              "searchEntityProperties",
              "resolveEntityByName",
              "queryTableRowsByFieldNames",
            ].includes(selectedTest) && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Search Text
                </label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Enter search query..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* Entity Type */}
            {["resolveEntityByName", "getEntityById", "getEntityContext", "getEntityContextById"].includes(selectedTest) && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Entity Type
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="task">Task</option>
                  <option value="project">Project</option>
                  <option value="client">Client</option>
                  <option value="member">Member</option>
                  <option value="tab">Tab</option>
                  <option value="block">Block</option>
                  <option value="doc">Doc</option>
                  <option value="table">Table</option>
                  <option value="table_row">Table Row</option>
                  <option value="timeline_event">Timeline Event</option>
                  <option value="file">File</option>
                  <option value="payment">Payment</option>
                  <option value="tag">Tag</option>
                </select>
              </div>
            )}

            {/* Entity ID */}
            {["getEntityById", "getEntityContext", "getEntityContextById"].includes(selectedTest) && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Entity ID
                </label>
                <input
                  type="text"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Enter entity ID..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* Table ID */}
            {[
              "getTableSchema",
              "resolveTableFieldByName",
              "queryTableRowsByFieldNames",
              "searchTableFields",
              "searchTableViews",
              "searchTableRows",
            ].includes(selectedTest) && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Table ID
                </label>
                <input
                  type="text"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  placeholder="Enter table ID..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* Doc ID */}
            {selectedTest === "searchDocContent" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Doc ID
                </label>
                <input
                  type="text"
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="Enter doc ID..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* Field Name */}
            {selectedTest === "resolveTableFieldByName" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Field Name
                </label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g., Status, Owner..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* Task-specific filters */}
            {selectedTest === "searchTasks" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Assignee Name (NEW)
                  </label>
                  <input
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    placeholder="e.g., John"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Tag Name (NEW)
                  </label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="e.g., urgent"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">All</option>
                    <option value="todo">Todo</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </>
            )}

            {/* Limit */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Limit
              </label>
              <input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 1)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Include Content */}
            {["searchAll", "searchDocs"].includes(selectedTest) && (
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeContent}
                    onChange={(e) => setIncludeContent(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    {selectedTest === "searchDocs" ? "Search Both (Title + Content)" : "Include Content"}
                  </span>
                </label>
              </div>
            )}

            {/* Extra Params */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Extra Params (JSON)
              </label>
              <textarea
                value={extraParams}
                onChange={(e) => setExtraParams(e.target.value)}
                className="w-full border rounded px-3 py-2 font-mono text-xs h-28"
                placeholder='e.g. {"projectId":"...","status":["todo","done"]}'
              />
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={runTest}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? "Running..." : "Run Test"}
          </button>
        </div>

        {/* Results */}
        {renderResults()}
      </div>
    </div>
  );
}
