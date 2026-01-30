We are now going to start implementing a file analysis tool.

File Analysis (Chat Interface):

Nature: Ephemeral, conversational Q\&A

Interface: Right sidebar chat panel

Scope: Contextual to current location (tab/page)

Output: Text responses that can be saved as blocks/comments

Use Case: Quick questions, exploratory analysis, understanding specific files

System Components

User Context Layer

├── Current Location (Dashboard | Project | Tab | Page)

├── Uploaded Files (Attached to projects/tabs)

├── Chat History (Per-tab, ephemeral)

AI Processing Layer

├── DeepSeek V3.2 (Primary model)

├── Context Assembly (Files, tables, tasks, pages)

├── Smart Data Retrieval (Use RAG/Embeddings  for larger files, and send the entire file straight to the AI if small enough)

└── Response Generation (Text, tables, charts, recommendations)

Information Flow

1\. User Context Detection

├── Where is user? (Dashboard/Project/Tab/Page)

├── What files are available?

├── What's the relevant history?

└── What data exists in this context?

2\. Query Processing

├── Determine scope (local vs cross-tab vs workspace)

├── Identify required files/data

├── Process data- use RAG/embeddings for large files, send the entire file to the AI if relatively small

└── Send to AI with full context

3\. Response Generation

├── AI analyzes data

├── Generates response (text/table/chart. Use the existing tools to do so. Ie. use the createTable tools to create tools to represent data if requested) 

├── Suggests actions (save options)

└── Provides citations (which files used)

4\. User Action

├── Save as block (inline on current page)

├── Save as comment (on specific file)

### **Core Capabilities**

**1\. File Upload & Recognition**

* User can upload files directly to chat OR attach files to project/tab first  
* Supported formats: CSV, Excel (xlsx, xls), PDF, images (jpg, png), Word docs (docx)  
* AI immediately recognizes file type and generates summary  
* If file already attached to project, AI can reference it by name or context

**2\. Natural Language Querying**

* User asks questions in plain English  
* No SQL, formulas, or technical syntax required  
* AI interprets intent and accesses appropriate data. Using RAG and embeddings for larger files or send the entire file to the AI if its small enough.   
* Follow-up questions maintain context

**3\. Contextual Responses**

* Responses appear in chat sidebar  
* Can include: text, tables, charts, metrics  
* Each response is ephemeral until user saves it  
* AI cites which files/data it used for answer

**4\. Flexible Saving**

* Save response as block on current page  
* Save as comment on specific file (if file is attached)  
* Or don't save (just get quick answer and move on)

**Activation Methods:**

1. **CMD+K anywhere** → Opens chat in right sidebar  
2. **Upload file** → Chat automatically opens with file context  
3. **Click "Analyze" on attached file** → Opens chat with that file loaded  
4. **@mention file name** → Opens chat with that file loaded

### **Triggering File Analysis**

**Method 1: Upload File in Chat**

User opens chat (CMD+K)  
User drags file into chat OR clicks upload button  
File appears in chat: \[Q1\_Expenses.csv uploaded\]  
AI: "I've received Q1\_Expenses.csv. It contains 1,247 transactions   
     totaling $52,389. What would you like to know?"  
User can now ask questions

**Method 2: Ask About Attached File**

User is in Manufacturing tab (has Q1\_Expenses.csv already attached)  
User opens chat (CMD+K)  
User: "Analyze the Q1 expenses"  
AI: "I found Q1\_Expenses.csv in this tab. \[Analyzes...\]   
     Total expenses: $83k. Top 3 categories..."

**Method 3: Reference File by Name**

User opens chat  
User: "Look at the December sales file"  
AI: "I found December\_Sales.csv in this project. Loading it now..."  
\[Analyzes file\]  
AI: "December revenue was $52k..."

**Method 4: Upload Multiple Files**

User uploads 3 files: Jan\_Sales.csv, Feb\_Sales.csv, Mar\_Sales.csv  
AI: "I've received 3 sales files covering Q1 2026\.   
     Would you like me to analyze them individually or together?"  
User: "Together \- show me Q1 trends"  
AI: \[Cross-file analysis\]

### **Context Awareness**

**AI Always Knows:**

1. **Current Location**

   * Dashboard, specific project, specific tab, specific page  
   * Which determines default scope for queries  
2. **Available Files**

   * All files in current tab/page  
   * All files in current project  
   * Files uploaded in current chat session  
3. **Project Data**

   * Tables that exist in project  
   * Tasks and their status  
   * Pages and their content  
   * Previous chat history in this tab  
4. **User Intent Inference**

   * "What sold best?" → Looks for sales data in context  
   * "Compare to last month" → Finds previous month's data  
   * "Show me trends" → Generates time-series analysis

**Context Hierarchy (What AI Searches First):**

1\. Current chat session (files just uploaded)  
2\. Current page/tab (attached files)  
3\. Current project (all files in project)  
4\. Workspace (if query seems workspace-wide)

**Example of Context Awareness:**

User is in: Spring Peptide Launch → Manufacturing tab  
Tab contains: Q1\_Expenses.csv, Supplier\_Quotes.pdf, Production\_Schedule.xlsx

User asks: "What are our biggest costs?"

AI reasoning:  
\- User is in Manufacturing tab  
\- Question about "costs"   
\- Q1\_Expenses.csv is most relevant  
\- Analyzes that file first  
\- Responds: "Based on Q1\_Expenses.csv, your biggest costs are..."

### **Response Types**

**Text Responses:**

User: "What was total revenue?"  
AI: "Total revenue for Q1 2026 was $156,389 across 4,247 transactions."

\[Save as Block\] 

**Table Responses:**

User: "Show me top products"  
AI generates table:

┌────────────────┬──────────┬──────────┐  
│ Product        │ Units    │ Revenue  │  
├────────────────┼──────────┼──────────┤  
│ Peppermint     │ 423      │ $8,037   │  
│ Regular Latte  │ 312      │ $4,368   │  
│ Hot Chocolate  │ 198      │ $2,772   │  
└────────────────┴──────────┴──────────┘

\[Save as Block\] \[Create Workflow Page\]

**Chart Responses:**

User: "Show me monthly trend"  
AI generates line chart showing Jan/Feb/Mar data

\[Save as Block\] 

**Comparative Analysis:**

User: "Compare Q1 to Q4"  
AI: "Q1 revenue: $156k (+12% vs Q4: $139k)  
     Key drivers: Seasonal products up 45%, Weekend traffic \+23%"  
       
\[Includes table showing side-by-side comparison\]

\[Save as Block\] 

**Recommendations:**

User: "What should I focus on?"  
AI: "Based on your Q1 data, here are 3 priorities:

1\. Scale peppermint lattes (34% of revenue, 68% margin)  
2\. Increase weekend staffing (turning away customers)  
3\. Test oat milk line (40% growth trend in category)

\[Create Tasks\] \[Save as Block\] \[Create Workflow Page\]

### **Saving Options**

After every AI response, user sees context-appropriate save buttons:

**Option 1: Save as Block on This Page**

* **When Available:** Always, when user is in a page/tab  
* **Action:** Inserts AI response as block(s) at cursor position or end of page  
* **What Gets Saved:** The insight/data (not the chat format)  
* **Result:** Page now contains that analysis inline

**Example:**

Before:  
┌────────────────────────────────┐  
│ \# Manufacturing Overview       │  
│                                │  
│ Q1 cost review in progress...  │  
│                                │  
│ \[Attached: Q1\_Expenses.csv\]    │  
└────────────────────────────────┘

User asks in chat: "What are top 3 costs?"  
AI responds with table  
User clicks: \[Save as Block\]

After:  
┌────────────────────────────────┐  
│ \# Manufacturing Overview       │  
│                                │  
│ Q1 cost review in progress...  │  
│                                │  
│ \[Attached: Q1\_Expenses.csv\]    │  
│                                │  
│ \#\# Top Cost Categories         │  
│ ┌──────────┬────────┐          │  
│ │ Category │ Amount │          │  
│ ├──────────┼────────┤          │  
│ │ Packaging│ $45k   │          │  
│ │ Raw Mat. │ $38k   │          │  
│ │ Labor    │ $22k   │          │  
│ └──────────┴────────┘          │  
└────────────────────────────────┘

**Option 2: Save as Comment on File**

* **When Available:** Only when file is attached to project (not just uploaded in chat)  
* **Action:** Attaches insight as comment directly on the file  
* **What Gets Saved:** Text summary of insight  
* **Result:** File now has annotation visible to anyone viewing it

**Example:**

File: Q1\_Expenses.csv (attached to Manufacturing tab)

User asks: "What's the profit margin on peppermint lattes?"  
AI: "68% margin ($2.56 cost, $8.00 price)"  
User clicks: \[Save as Comment on File\]

Result:  
┌────────────────────────────────────────┐  
│ Manufacturing Tab                      │  
│                                        │  
│ \[Attached: Q1\_Expenses.csv\]            │  
│ 💬 Comment (AI Analysis):              │  
│    "Peppermint lattes: 68% profit     │  
│     margin \- excellent performer"      │  
└────────────────────────────────────────┘

### **Chat History Persistence**

**Per-Tab Chat History (Hybrid Model):**

**What User Sees:**

* Each tab has its own visible chat history  
* Switching from Manufacturing tab → Marketing tab \= new clean chat interface  
* Keeps conversations organized and relevant

**What AI Knows:**

* Has access to entire project context (all files, all tabs)  
* Can reference data from other tabs when needed  
* Maintains project-wide memory

**Example Flow:**

\[User in Manufacturing tab\]  
Chat history shows:  
\- "What are top expenses?" → AI response about Q1 costs  
\- "Compare to Q4" → AI response showing comparison

\[User switches to Marketing tab\]  
Chat history shows:  
\- Empty (new chat interface)

User asks: "How does marketing spend compare to manufacturing costs?"

AI: "I see you discussed manufacturing costs in the Manufacturing   
     tab ($83k total). Your marketing spend is $28k (Q1 budget   
     breakdown). That's a 3:1 ratio.  
       
     \[Used: Manufacturing tab → Q1\_Expenses.csv\]"

**Cross-Tab References:**

**Automatic (AI detects need):**

User in Marketing tab  
User: "Compare our spend to production costs"

AI automatically:  
1\. Recognizes "production costs" likely in Manufacturing tab  
2\. Accesses Manufacturing data  
3\. Responds with comparison  
4\. Shows what it accessed: "\[Used: Manufacturing tab → Q1\_Expenses.csv\]"

**Explicit (User specifies):**

User: "Use the expense data from Manufacturing tab"  
AI: "Got it, accessing Manufacturing tab data..."

**Ambiguous (AI asks for clarification):**

User: "How do our costs compare?"

AI: "Do you mean:  
     \- Marketing costs over time?  
     \- Marketing vs manufacturing? (I see data in Manufacturing tab)  
     \- Marketing vs budget?"

**Chat History Retention:**

* Per-tab history persists for entire project lifecycle  
* Visible when you return to that tab  
* Can be cleared manually by user  
* Archived if tab is deleted (recoverable for 30 days)

### **File Analysis Workflows**

**Workflow 1: Quick Fact Check (No Saving)**

Time: 10-30 seconds  
Saves: Nothing

1\. User in any tab  
2\. CMD+K to open chat  
3\. "What was total revenue last month?"  
4\. AI: "$52,389"  
5\. User closes chat  
6\. Done

**Workflow 2: Exploratory Analysis (Save Some Insights)**

Time: 2-5 minutes  
Saves: Blocks inline on current page

1\. User in Manufacturing tab  
2\. Uploads Q1\_Expenses.csv  
3\. Asks 3-4 questions:  
   \- "What are top costs?"  
   \- "Show monthly breakdown"  
   \- "Why did February spike?"  
4\. For each useful answer, clicks \[Save as Block\]  
5\. Insights now embedded in Manufacturing page  
6\. User continues working on that page

**Workflow 4: Multi-File Comparison**

Time: 3-8 minutes  
Saves: Blocks or new page (user decides)

1\. User in Sales tab  
2\. Uploads Q1\_Sales.csv, Q2\_Sales.csv, Q3\_Sales.csv  
3\. AI: "I've received 3 quarters of sales data. Analyze together?"  
4\. User: "Yes, show me year-to-date trends"  
5\. AI generates comprehensive cross-quarter analysis  
6\. User: "Add forecast for Q4"  
7\. AI adds projection based on trends  
8\. User decides:  
   Option A: \[Save as Block\] → stays in Sales tab  
   Option B: \[Create new Page\] → becomes standalone report

**Workflow 5: File Without Upload (Reference Existing)**

Time: 1-3 minutes  
Saves: Variable

1\. User in Budget Planning tab (has Budget\_2026.xlsx already attached)  
2\. Opens chat  
3\. "Show me where we're over budget"  
4\. AI: "Found Budget\_2026.xlsx in this tab. Analyzing..."  
5\. AI: "You're over in 3 categories: Marketing (+12%), Travel (+8%)..."  
6\. User: \[Save as Block\] → insight appears on Budget Planning page

### **Special Scenarios**

**Scenario 1: File Uploaded in Chat (Not Attached to Project)**

User is in Manufacturing tab  
User opens chat  
User uploads Competitor\_Pricing.pdf (just in chat, not attached to project)

User: "How do their prices compare to ours?"  
AI: \[Analyzes PDF\]

Save options shown:  
\[Save as Block on This Page\] ← Saves insight to Manufacturing tab  
\[Create Workflow Page\] ← Creates new page with analysis  
\[Save as Comment on File\] ← NOT SHOWN (file not attached to project)

**Scenario 2: Multiple Files, Specific Question About One**

Tab has: Q1\_Sales.csv, Q2\_Sales.csv, Budget.xlsx

User: "What was Q2 revenue?"

AI: "Found Q2\_Sales.csv. Q2 revenue was $187,450."

\[Used: Q2\_Sales.csv\] ← Shows which file it accessed

**Scenario 3: File Needs Confirmation**

User: "Analyze the sales data"

Tab has: Q1\_Sales.csv, Q2\_Sales.csv, Annual\_Sales.csv

AI: "I found 3 sales files in this tab:  
     1\. Q1\_Sales.csv  
     2\. Q2\_Sales.csv    
     3\. Annual\_Sales.csv  
       
     Which one should I analyze? Or all three?"

User: "Q1"

AI: \[Analyzes Q1\_Sales.csv\]

**Scenario 4: Cross-Tab File Analysis**

User in Marketing tab  
User: "Compare our marketing spend to what manufacturing is spending"

AI recognizes:  
\- Marketing spend data likely in current tab  
\- Manufacturing spend in Manufacturing tab

AI: "Accessing data from Manufacturing tab...  
       
     Marketing (this tab): $28k  
     Manufacturing (Manufacturing tab): $83k  
     Ratio: 1:3  
       
     \[Used: Marketing/Budget.xlsx, Manufacturing/Q1\_Expenses.csv\]"

**Scenario 5: Large File Handling**

User uploads 500MB Excel file with 100k rows

AI: "This is a large file (100,000 rows). I'll process it now.  
     This may take 30-60 seconds..."

\[AI parses file, stores in database\]

AI: "File processed. I can now answer questions about this data.  
     What would you like to know?"

Note: Subsequent questions are fast because data is now in database

### 

