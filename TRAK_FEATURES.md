# Trak Feature Summary

## Overview
Trak is a comprehensive project management and collaboration platform designed for teams to organize work, manage tasks, create documents, and collaborate with clients. Built with Next.js, React, TypeScript, and Supabase (PostgreSQL).

---

## Core Features

### 1. Workspace Management
- **Multi-Workspace Support**: Users can belong to multiple workspaces
- **Workspace Switching**: Easy switching between workspaces via sidebar
- **Role-Based Access**: Three roles per workspace:
  - **Owner**: Full control, can manage members
  - **Admin**: Can manage members and projects
  - **Teammate**: Standard member with project access
- **Workspace Context**: Persistent workspace selection via cookies

### 2. Project Management
- **Project Types**:
  - **Projects**: Client-facing projects
  - **Internal Spaces**: Internal team resources (e.g., "Files" space)
- **Project Properties**:
  - Name and status (Not Started, In Progress, Complete)
  - Client association (optional)
  - Due dates (date and/or text)
  - Project type classification
- **Project Organization**:
  - Filter by status, client, project type
  - Search by project name or client name
  - Sort by created date, updated date, due date, or name
  - Project statistics dashboard

### 3. Hierarchical Tab System
- **Nested Tabs**: Tabs can have parent tabs (unlimited nesting)
- **Tab Organization**: 
  - Name and position-based ordering
  - Multiple tabs per project
  - Default "Untitled" tab created with each project
- **Tab Visibility Control**: 
  - Per-tab client visibility toggle (`client_visible`)
  - Sticky tab bar navigation
  - Tab themes (6 customizable background options)
- **Tab Containerization**: Blocks grouped in styled containers per tab

### 4. Rich Block System
Blocks are flexible content units that can be added to tabs. Each block type has unique capabilities:

#### **Task Blocks**
- **Task Lists**: Multiple tasks per block with optional title
- **Task Properties**:
  - Status: Todo, In Progress, Done
  - Priority: Urgent, High, Medium, Low, None
  - Assignees: Multiple team members per task
  - Due dates and times (with smart labels: "Today", "Tomorrow")
  - Start dates
  - Tags (custom labels)
  - Descriptions (expandable text)
  - Subtasks (nested task lists)
  - Attachments
  - Comments
  - Recurring task settings
- **Task Management**:
  - Inline editing
  - Drag-and-drop reordering
  - Icon visibility controls (global and per-task)
  - Click-to-change priority
  - Visual "In Progress" indicators
- **Smart Features**:
  - Assignee tooltips (shows all assigned members on hover)
  - Single assignee name display vs. count for multiple
  - Auto-save on blur

#### **Text Blocks**
- **Rich Text Editing**:
  - Markdown formatting support (bold, italic, underline, code, headings)
  - Contenteditable editor (no markdown syntax visible while editing)
  - Inline toolbar (bold, italic, underline, code, headings)
  - Auto-save functionality
- **Formatting**:
  - Headings (H1, H2, H3)
  - Bold, italic, underline
  - Inline code
  - List formatting
- **Display**: Formatted preview with markdown converted to HTML

#### **Other Block Types**
- **File Blocks**: Document uploads and management
- **Image Blocks**: Image uploads with preview
- **Video Blocks**: Video uploads with player
- **PDF Blocks**: PDF document viewing
- **Link Blocks**: External link references
- **Embed Blocks**: Embedded content (iframes)
- **Table Blocks**: Structured data tables
- **Timeline Blocks**: Timeline visualization
- **Divider Blocks**: Visual separators
- **Section Blocks**: Collapsible content sections
- **Doc Reference Blocks**: References to standalone documents

### 5. Document Management (Docs)
- **Rich Text Documents**: Standalone documents separate from projects
- **ProseMirror Editor**: Full-featured rich text editor
- **Document Features**:
  - Title and content
  - Auto-save
  - Export options (PDF, Markdown, Text)
  - Archive/unarchive functionality
- **Document Themes**: 6 customizable background themes
- **Document Organization**:
  - Filter by archived status
  - Search by title
  - Sort by created date, updated date, or title
- **Content Search**: Full-text search within document content

### 6. Client Management
- **Client Database**:
  - Client name and company
  - Notes and metadata
  - Project association tracking
- **Client Statistics**:
  - Total projects per client
  - Project status breakdown (active, completed, not started)
- **Client Linking**: Projects can be associated with clients

### 7. Client Sharing
- **Public Client Pages**:
  - Shareable public URLs via secure tokens
  - Per-tab visibility control
  - Read-only access for clients
  - Clean, branded client interface
- **Client Page Management**:
  - Enable/disable client pages per project
  - Control which tabs are visible to clients
  - Public token generation
  - Warning dialogs if no tabs are visible

### 8. Calendar System
- **Multiple Views**:
  - **Monthly View**: Traditional month grid with events
  - **Weekly View**: Week layout with event positioning
  - **Daily View**: Hour-by-hour timeline (defaults to 7 AM start)
- **Calendar Features**:
  - Task integration (tasks with due dates appear as events)
  - Event creation dialog
  - Event popup cards (click on event for details)
  - Day details side panel (click on day for full details)
  - Today button for quick navigation
  - Month/week/day navigation
- **Event Management**:
  - Create events linked to tasks
  - Project and tab selection for events
  - Priority assignment
  - Date and time selection
- **Calendar Themes**: 6 customizable background themes (Default, Sunset, Ocean, Lavender, Sage, Cloud)

### 9. Global Search
- **Comprehensive Search**:
  - Search across all content types simultaneously
  - Real-time search as you type (debounced)
  - Keyboard shortcut: Cmd/Ctrl + K
- **Searchable Content**:
  - Projects (by name)
  - Documents (by title and content)
  - Tasks (by task text)
  - Text blocks (by content)
  - Tabs (by name)
- **Search Features**:
  - Highlighted search term matches in previews
  - Contextual previews (shows where match was found)
  - Grouped results by type
  - Keyboard navigation (arrow keys, Enter, Escape)
  - Direct navigation to results
  - Result count per type

### 10. Commenting System
- **Block Comments**:
  - Comments can be added to any block type
  - Side-aligned comment sidebar
  - Collapsible comment sections
- **Comment Features**:
  - Author attribution ("You" for own comments)
  - Timestamps ("X time ago" format)
  - Comment count indicators
  - Add comment via plus icon
  - Reply functionality (icon)
  - Collapsed indicator (tiny square)
  - Smooth scrolling to new comments

### 11. File Management
- **File Uploads**:
  - Drag-and-drop file upload zones
  - Multiple file types supported
  - Quick upload for internal spaces
- **File Organization**:
  - Default "Files" internal space
  - File attachments to tasks
  - File blocks in tabs
- **File Types**: Images, videos, PDFs, documents

### 12. Dashboard Overview
- **Real-Time Statistics**:
  - Active projects count
  - Project status breakdown (not started, in progress, complete)
  - Recent projects (5 most recent)
  - Recent documents (5 most recent)
  - Current tasks with priorities and due dates
- **Task Lists**:
  - Today's tasks
  - Tasks with priority flags
  - Tasks with due date flags
- **Activity Feed**:
  - Client updates
  - Team updates
  - Material updates
- **Quick Actions**: Quick access to create projects, docs, etc.

### 13. UI/UX Features

#### **Theming & Customization**
- **Dark/Light Mode**: Full theme support
- **Customizable Backgrounds**:
  - Document themes (6 options)
  - Calendar themes (6 options)
  - Tab themes (6 options)
- **Modern Design**: Liquid glass/Apple-inspired aesthetic
  - Translucent backgrounds
  - Backdrop blur effects
  - Subtle shadows and gradients
  - Smooth transitions and animations

#### **Navigation**
- **Collapsible Sidebar**: 
  - Icon-only collapsed state
  - Full sidebar with search
  - Workspace switcher
  - Navigation links (Home, Projects, Clients, Docs, Calendar, Internal)
- **Sticky Headers**: Tab bars and navigation elements
- **Breadcrumbs**: Clear navigation paths

#### **Responsive Design**
- Mobile-friendly layouts
- Adaptive UI elements
- Touch-friendly interactions

### 14. Workspace Collaboration

#### **Team Management**
- **Member Invitations**: Invite team members by email
- **Role Management**: Update member roles (owner/admin/teammate)
- **Member Removal**: Remove members (with safeguards)
- **Permission System**: Role-based access control

#### **Real-Time Updates**
- Optimistic UI updates
- Auto-refresh and cache invalidation
- Collaborative editing indicators

### 15. Advanced Features

#### **Block Management**
- **Drag-and-Drop Reordering**: Reorder blocks within tabs
- **Multi-Column Layouts**: Blocks can be arranged in up to 3 columns
- **Block Templates**: Reusable block templates across projects
- **Block References**: Reference blocks from other tabs/projects
- **Nested Blocks**: Blocks can have child blocks (e.g., sections)

#### **Task Features**
- **Smart Date Labels**: "Today" and "Tomorrow" auto-detection
- **Time Management**: Specific due times per task
- **Visual Indicators**: Priority flags, status badges, progress indicators
- **Task Filtering**: Icon visibility controls, status filtering

#### **Document Features**
- **Export Options**: PDF, Markdown, and Text export
- **Content Search**: Full-text search within ProseMirror content
- **Auto-Save**: Automatic saving while editing
- **Version Awareness**: Created/updated timestamps

#### **Internal Spaces**
- **Organizational Tools**: Separate internal project spaces
- **File Management**: Dedicated file organization space
- **Team Resources**: Internal-only content and files

---

## Technical Features

### **Performance**
- Optimized database queries with limits
- Batch processing for large datasets
- Early exit strategies in searches
- Relationship caching (Map-based lookups)
- Debounced search inputs
- Selective field fetching

### **Security**
- Workspace-based access control
- Server-side authentication checks
- Token-based client sharing
- Membership verification on all operations
- Cross-workspace data isolation

### **Data Architecture**
- Flexible JSONB content storage
- Relational data for structured content
- Hierarchical data models (tabs, blocks)
- Efficient relationship queries
- Optimized indexing strategies

---

## User Experience Highlights

1. **Minimalist Interface**: Clean, uncluttered design focused on content
2. **Fast Interactions**: Optimistic updates, instant feedback
3. **Keyboard Shortcuts**: Cmd/Ctrl+K for search, Escape to close
4. **Contextual Menus**: Three-dot menus throughout for actions
5. **Smart Defaults**: Auto-created tabs, sensible positioning
6. **Visual Feedback**: Loading states, save indicators, hover effects
7. **Accessibility**: Keyboard navigation, clear focus states
8. **Mobile Responsive**: Works across device sizes

---

## Current Limitations

- Comments are searchable but not currently included in global search
- File content (PDFs, images) is not searchable (only metadata)
- No real-time collaborative editing (optimistic updates only)
- No built-in notifications system
- No email integrations
- No time tracking
- No reporting/analytics dashboards

---

This feature set makes Trak a comprehensive project management platform suitable for teams working with clients, managing internal resources, and organizing complex projects with multiple content types and collaboration needs.

