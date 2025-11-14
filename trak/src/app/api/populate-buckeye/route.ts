import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTab } from "@/app/actions/tab";
import { createBlock } from "@/app/actions/block";

export async function POST() {
  try {
    const supabase = await createClient();

    // Find Buckeye Brownies project
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", "%buckeye%")
      .limit(1);

    if (projectError || !projects || projects.length === 0) {
      return NextResponse.json(
        { error: "Could not find Buckeye Brownies project" },
        { status: 404 }
      );
    }

    const project = projects[0];

    // Get the first tab
    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, name")
      .eq("project_id", project.id)
      .order("position", { ascending: true })
      .limit(1);

    if (tabsError || !tabs || tabs.length === 0) {
      return NextResponse.json(
        { error: "Could not find any tabs" },
        { status: 404 }
      );
    }

    const mainTab = tabs[0];

    // Create subtabs
    const subtabs = [
      "Overview",
      "Production Schedule",
      "Marketing Assets",
      "Packaging",
      "Distribution",
      "Budget & Costs",
    ];

    const createdSubtabs: { id: string; name: string }[] = [];

    for (let i = 0; i < subtabs.length; i++) {
      const result = await createTab({
        projectId: project.id,
        name: subtabs[i],
        parentTabId: mainTab.id,
      });

      if (result.error) {
        console.error(`Error creating subtab ${subtabs[i]}:`, result.error);
      } else if (result.data) {
        createdSubtabs.push({ id: result.data.id, name: result.data.name });
      }
    }

    // Add blocks to Overview
    if (createdSubtabs.length > 0) {
      const overviewTab = createdSubtabs[0];

      await createBlock({
        tabId: overviewTab.id,
        type: "text",
        content: {
          text: `# Buckeye Brownies Launch

## Project Overview

We're launching a new line of premium buckeye brownies for the holiday season. This project encompasses everything from recipe development to final distribution.

### Key Objectives
- Launch 3 SKUs by December 1st
- Achieve 10,000 units sold in first month
- Establish brand presence in 50+ retail locations
- Generate $150K in revenue

### Timeline
- **Phase 1**: Recipe & Testing (Weeks 1-2)
- **Phase 2**: Production Setup (Weeks 3-4)
- **Phase 3**: Marketing & Distribution (Weeks 5-6)
- **Phase 4**: Launch & Monitoring (Week 7+)`,
        },
        position: 0,
      });

      await createBlock({
        tabId: overviewTab.id,
        type: "task",
        content: {
          title: "Key Milestones",
          tasks: [
            { id: "1", text: "Finalize recipe with head chef", completed: true },
            { id: "2", text: "Secure production facility", completed: true },
            { id: "3", text: "Design packaging", completed: false },
            { id: "4", text: "Photography shoot", completed: false },
            { id: "5", text: "Website launch", completed: false },
            { id: "6", text: "First production run", completed: false },
          ],
        },
        position: 1,
      });

      await createBlock({
        tabId: overviewTab.id,
        type: "table",
        content: {
          title: "Product SKUs",
          columns: [
            { id: "col1", name: "SKU", type: "text" },
            { id: "col2", name: "Quantity", type: "text" },
            { id: "col3", name: "Ship Date", type: "text" },
            { id: "col4", name: "Status", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Classic Buckeye",
                col2: "2,400 boxes",
                col3: "Dec 8",
                col4: "Locked",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Peppermint Buckeye",
                col2: "1,600 boxes",
                col3: "Dec 9",
                col4: "Packaging art in review",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Salted Caramel Buckeye",
                col2: "2,000 boxes",
                col3: "Dec 10",
                col4: "Recipe testing",
              },
            },
          ],
        },
        position: 2,
      });
    }

    // Add blocks to Production Schedule
    if (createdSubtabs.length > 1) {
      const productionTab = createdSubtabs[1];

      await createBlock({
        tabId: productionTab.id,
        type: "text",
        content: {
          text: `# Production Schedule

## Week-by-Week Breakdown

### Week 1-2: Recipe Development
- Test base brownie recipe
- Develop buckeye filling consistency
- Flavor profile testing
- Shelf life testing

### Week 3-4: Production Setup
- Equipment calibration
- Staff training
- Quality control protocols
- Packaging line setup

### Week 5-6: Pre-Launch Production
- Small batch production runs
- Quality assurance testing
- Inventory management setup
- Distribution coordination`,
        },
        position: 0,
      });

      await createBlock({
        tabId: productionTab.id,
        type: "task",
        content: {
          title: "Production Tasks",
          tasks: [
            { id: "1", text: "Order ingredients in bulk", completed: true },
            { id: "2", text: "Schedule production staff", completed: false },
            { id: "3", text: "Set up quality control checkpoints", completed: false },
            { id: "4", text: "Coordinate with packaging team", completed: false },
            { id: "5", text: "Run test batches", completed: false },
          ],
        },
        position: 1,
      });
    }

    // Add blocks to Marketing Assets
    if (createdSubtabs.length > 2) {
      const marketingTab = createdSubtabs[2];

      await createBlock({
        tabId: marketingTab.id,
        type: "text",
        content: {
          text: `# Marketing Assets

## Required Materials

### Photography
- Product shots (hero images)
- Lifestyle photography
- Behind-the-scenes content
- Social media assets

### Copy
- Product descriptions
- Website content
- Social media captions
- Email marketing copy

### Design
- Packaging design
- Website graphics
- Social media templates
- Print materials`,
        },
        position: 0,
      });

      await createBlock({
        tabId: marketingTab.id,
        type: "link",
        content: {
          url: "https://www.instagram.com/buckeyebrownies",
          title: "Buckeye Brownies Instagram",
          description: "Follow us for behind-the-scenes content and updates",
        },
        position: 1,
      });
    }

    // Add blocks to Packaging
    if (createdSubtabs.length > 3) {
      const packagingTab = createdSubtabs[3];

      await createBlock({
        tabId: packagingTab.id,
        type: "text",
        content: {
          text: `# Packaging Requirements

## Design Specifications
- Eco-friendly materials
- Window for product visibility
- Brand logo prominently displayed
- Nutritional information panel
- Barcode placement

## Timeline
- Design approval: Nov 15
- Print production: Nov 20
- Delivery: Nov 25
- Assembly: Nov 28`,
        },
        position: 0,
      });
    }

    // Add blocks to Distribution
    if (createdSubtabs.length > 4) {
      const distributionTab = createdSubtabs[4];

      await createBlock({
        tabId: distributionTab.id,
        type: "table",
        content: {
          title: "Distribution Partners",
          columns: [
            { id: "col1", name: "Retailer", type: "text" },
            { id: "col2", name: "Location", type: "text" },
            { id: "col3", name: "Order Qty", type: "text" },
            { id: "col4", name: "Status", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Whole Foods",
                col2: "Regional",
                col3: "500 boxes",
                col4: "Confirmed",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Local Markets",
                col2: "Various",
                col3: "300 boxes",
                col4: "Pending",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Online Store",
                col2: "N/A",
                col3: "1,000 boxes",
                col4: "Live",
              },
            },
          ],
        },
        position: 0,
      });
    }

    // Add blocks to Budget & Costs
    if (createdSubtabs.length > 5) {
      const budgetTab = createdSubtabs[5];

      await createBlock({
        tabId: budgetTab.id,
        type: "table",
        content: {
          title: "Budget Breakdown",
          columns: [
            { id: "col1", name: "Category", type: "text" },
            { id: "col2", name: "Budgeted", type: "text" },
            { id: "col3", name: "Spent", type: "text" },
            { id: "col4", name: "Remaining", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Ingredients",
                col2: "$25,000",
                col3: "$12,500",
                col4: "$12,500",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Packaging",
                col2: "$15,000",
                col3: "$8,200",
                col4: "$6,800",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Marketing",
                col2: "$20,000",
                col3: "$5,000",
                col4: "$15,000",
              },
            },
            {
              id: "row4",
              cells: {
                col1: "Distribution",
                col2: "$10,000",
                col3: "$2,500",
                col4: "$7,500",
              },
            },
          ],
        },
        position: 0,
      });

      await createBlock({
        tabId: budgetTab.id,
        type: "text",
        content: {
          text: `## Budget Summary

**Total Budget**: $70,000
**Total Spent**: $28,200
**Remaining**: $41,800

### Notes
- Ingredients costs are on track
- Packaging slightly over budget due to premium materials
- Marketing spend is conservative, room for expansion
- Distribution costs lower than expected`,
        },
        position: 1,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Buckeye Brownies project populated successfully",
      subtabsCreated: createdSubtabs.length,
    });
  } catch (error) {
    console.error("Error populating project:", error);
    return NextResponse.json(
      { error: "Failed to populate project", details: String(error) },
      { status: 500 }
    );
  }
}

