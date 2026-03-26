export default function TestDashboard() {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Saria Test Dashboard</h1>
        
        <div className="space-y-4">
          <a 
            href="/test/workspace" 
            className="block p-6 border rounded-[var(--radius-lg)] hover:bg-[var(--background)]"
          >
            <h2 className="text-xl font-semibold mb-2">Task 1.1: Workspace & Members</h2>
            <p className="text-[var(--muted-foreground)]">Test workspace creation, member management, and roles</p>
          </a>
  
          <a 
            href="/test/client" 
            className="block p-6 border rounded-[var(--radius-lg)] hover:bg-[var(--background)]"
          >
            <h2 className="text-xl font-semibold mb-2">Task 1.2: Client Management</h2>
            <p className="text-[var(--muted-foreground)]">Test client CRUD operations and project relationships</p>
          </a>
  
          <a 
            href="/test/project" 
            className="block p-6 border rounded-[var(--radius-lg)] hover:bg-[var(--background)]"
          >
            <h2 className="text-xl font-semibold mb-2">Task 1.3: Project Management</h2>
            <p className="text-[var(--muted-foreground)]">Test project CRUD operations and workflows/relationships</p>
          </a>
        </div>
      </div>
    )
  }