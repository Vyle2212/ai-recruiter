import type { SapSkillTaxonomyItem } from "@/lib/sapTalentTaxonomy";

export const SAP_TAXONOMY_SEED: SapSkillTaxonomyItem[] = [
  {
    "code": "FICO",
    "name": "Finance & Controlling",
    "category": "Finance",
    "aliases": [
      "FI CO",
      "FI/CO",
      "Finance",
      "Financial Accounting and Controlling",
      "SAP Finance",
      "RTR",
      "Record to Report",
      "R2R"
    ],
    "submodules": [
      "FI",
      "CO",
      "FI-GL",
      "FI-AP",
      "FI-AR",
      "FI-AA",
      "CO-PA",
      "CO-PC",
      "CCA",
      "PCA",
      "Internal Orders",
      "Product Costing",
      "Material Ledger"
    ],
    "active": true
  },
  {
    "code": "FI",
    "name": "Financial Accounting",
    "category": "Finance",
    "aliases": [
      "General Ledger",
      "GL",
      "Accounts Payable",
      "AP",
      "Accounts Receivable",
      "AR",
      "Asset Accounting"
    ],
    "submodules": [
      "FI-GL",
      "FI-AP",
      "FI-AR",
      "FI-AA",
      "FI-BL",
      "FI-TV",
      "New GL",
      "Document Splitting"
    ],
    "active": true
  },
  {
    "code": "CO",
    "name": "Controlling",
    "category": "Finance",
    "aliases": [
      "Management Accounting",
      "Costing",
      "Cost Center",
      "Profit Center"
    ],
    "submodules": [
      "CO-PA",
      "CO-PC",
      "CCA",
      "PCA",
      "Internal Orders",
      "Product Costing",
      "Profitability Analysis"
    ],
    "active": true
  },
  {
    "code": "FI-GL",
    "name": "General Ledger Accounting",
    "category": "Finance",
    "aliases": [
      "GL",
      "General Ledger",
      "New GL"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FI-AP",
    "name": "Accounts Payable",
    "category": "Finance",
    "aliases": [
      "AP",
      "Vendor Accounting",
      "Invoice Payment"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FI-AR",
    "name": "Accounts Receivable",
    "category": "Finance",
    "aliases": [
      "AR",
      "Customer Accounting",
      "Collections"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FI-AA",
    "name": "Asset Accounting",
    "category": "Finance",
    "aliases": [
      "AA",
      "Fixed Assets",
      "Asset Management",
      "Acquire to Retire",
      "A2R"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FI-BL",
    "name": "Bank Accounting",
    "category": "Finance",
    "aliases": [
      "Bank Accounting",
      "Bank Reconciliation"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FI-TV",
    "name": "Travel Management",
    "category": "Finance",
    "aliases": [
      "Travel Expense",
      "Travel Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CO-PA",
    "name": "Profitability Analysis",
    "category": "Finance",
    "aliases": [
      "COPA",
      "CO PA",
      "Margin Analysis"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CO-PC",
    "name": "Product Costing",
    "category": "Finance",
    "aliases": [
      "Product Costing",
      "Material Ledger Costing"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CCA",
    "name": "Cost Center Accounting",
    "category": "Finance",
    "aliases": [
      "Cost Center",
      "Cost Center Accounting"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PCA",
    "name": "Profit Center Accounting",
    "category": "Finance",
    "aliases": [
      "Profit Center",
      "Profit Center Accounting"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ML",
    "name": "Material Ledger",
    "category": "Finance",
    "aliases": [
      "Material Ledger",
      "Actual Costing"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CFIN",
    "name": "Central Finance",
    "category": "Finance",
    "aliases": [
      "Central Finance",
      "S/4 Central Finance",
      "cFIN"
    ],
    "submodules": [
      "Central Payments",
      "AIF",
      "SLT",
      "Initial Load"
    ],
    "active": true
  },
  {
    "code": "FSCM",
    "name": "Financial Supply Chain Management",
    "category": "Finance",
    "aliases": [
      "Credit Management",
      "Collections",
      "Dispute Management"
    ],
    "submodules": [
      "Credit Management",
      "Collections Management",
      "Dispute Management",
      "Biller Direct"
    ],
    "active": true
  },
  {
    "code": "TRM",
    "name": "Treasury and Risk Management",
    "category": "Finance",
    "aliases": [
      "Treasury",
      "Cash Management",
      "BCM",
      "Bank Communication Management"
    ],
    "submodules": [
      "Cash Management",
      "BCM",
      "In-House Cash",
      "Liquidity Planning"
    ],
    "active": true
  },
  {
    "code": "BCM",
    "name": "Bank Communication Management",
    "category": "Finance",
    "aliases": [
      "BCM",
      "Bank Communication"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IHC",
    "name": "In-House Cash",
    "category": "Finance",
    "aliases": [
      "In-House Cash",
      "IHC"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "GR",
    "name": "Group Reporting",
    "category": "Finance",
    "aliases": [
      "Group Reporting",
      "Consolidation",
      "S/4HANA Group Reporting"
    ],
    "submodules": [
      "Consolidation",
      "Intercompany Matching",
      "Financial Close"
    ],
    "active": true
  },
  {
    "code": "BPC",
    "name": "Business Planning and Consolidation",
    "category": "Finance",
    "aliases": [
      "BPC",
      "Planning and Consolidation"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SEM-BCS",
    "name": "Strategic Enterprise Management - Business Consolidation",
    "category": "Finance",
    "aliases": [
      "SEM BCS",
      "BCS",
      "Consolidation"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "RAR",
    "name": "Revenue Accounting and Reporting",
    "category": "Finance",
    "aliases": [
      "Revenue Accounting",
      "IFRS 15",
      "RAR"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "RE-FX",
    "name": "Flexible Real Estate Management",
    "category": "Finance",
    "aliases": [
      "Real Estate",
      "REFX",
      "RE FX"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PSM",
    "name": "Public Sector Management",
    "category": "Finance",
    "aliases": [
      "Funds Management",
      "Public Sector"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FM",
    "name": "Funds Management",
    "category": "Finance",
    "aliases": [
      "Funds Management",
      "Budget Control"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SD",
    "name": "Sales & Distribution",
    "category": "Logistics & SCM",
    "aliases": [
      "Sales and Distribution",
      "Order to Cash",
      "OTC",
      "O2C",
      "Order 2 Cash",
      "Billing",
      "Pricing",
      "Lead to Cash",
      "L2C"
    ],
    "submodules": [
      "OTC",
      "Pricing",
      "Billing",
      "Output Management",
      "aATP",
      "ATP",
      "Intercompany Sales",
      "Consignment",
      "LE-SHP"
    ],
    "active": true
  },
  {
    "code": "SD-BF",
    "name": "Basic Functions in SD",
    "category": "Logistics & SCM",
    "aliases": [
      "SD Basic Functions",
      "Pricing",
      "Output Determination"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SD-SLS",
    "name": "Sales",
    "category": "Logistics & SCM",
    "aliases": [
      "Sales Order",
      "Order Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SD-BIL",
    "name": "Billing",
    "category": "Logistics & SCM",
    "aliases": [
      "Billing",
      "Invoice",
      "Invoicing"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SD-LE",
    "name": "Shipping & Transportation",
    "category": "Logistics & SCM",
    "aliases": [
      "Shipping",
      "Delivery",
      "LE-SHP"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "aATP",
    "name": "Advanced Available-to-Promise",
    "category": "Logistics & SCM",
    "aliases": [
      "Advanced ATP",
      "aATP",
      "ATP"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MM",
    "name": "Materials Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Procure to Pay",
      "P2P",
      "PTP",
      "Procurement",
      "Purchasing",
      "Inventory Management"
    ],
    "submodules": [
      "Purchasing",
      "Inventory Management",
      "Invoice Verification",
      "Material Master",
      "Vendor Master",
      "Source Determination",
      "STO"
    ],
    "active": true
  },
  {
    "code": "MM-PUR",
    "name": "Purchasing",
    "category": "Logistics & SCM",
    "aliases": [
      "Purchasing",
      "Purchase Order",
      "PO",
      "Source Determination"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MM-IM",
    "name": "Inventory Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Inventory",
      "Goods Movement",
      "Stock"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MM-IV",
    "name": "Invoice Verification",
    "category": "Logistics & SCM",
    "aliases": [
      "Logistics Invoice Verification",
      "LIV",
      "Invoice Verification"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MM-MRP",
    "name": "Material Requirements Planning",
    "category": "Logistics & SCM",
    "aliases": [
      "MRP",
      "Material Planning"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "LE",
    "name": "Logistics Execution",
    "category": "Logistics & SCM",
    "aliases": [
      "Shipping",
      "Delivery",
      "Transportation"
    ],
    "submodules": [
      "LE-SHP",
      "LE-TRA",
      "Handling Unit Management"
    ],
    "active": true
  },
  {
    "code": "WM",
    "name": "Warehouse Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Warehouse",
      "Classic WM"
    ],
    "submodules": [
      "Storage Type",
      "Transfer Order",
      "Physical Inventory"
    ],
    "active": true
  },
  {
    "code": "EWM",
    "name": "Extended Warehouse Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Extended Warehouse",
      "Embedded EWM",
      "Decentralized EWM"
    ],
    "submodules": [
      "Inbound",
      "Outbound",
      "Physical Inventory",
      "Slotting",
      "Labor Management",
      "Yard Management"
    ],
    "active": true
  },
  {
    "code": "TM",
    "name": "Transportation Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Transportation",
      "Freight",
      "Freight Order",
      "Q2C",
      "Quote to Cash logistics"
    ],
    "submodules": [
      "Freight Unit",
      "Freight Order",
      "Charge Calculation",
      "Carrier Selection"
    ],
    "active": true
  },
  {
    "code": "GTS",
    "name": "Global Trade Services",
    "category": "Logistics & SCM",
    "aliases": [
      "Global Trade",
      "Compliance Management",
      "Customs Management"
    ],
    "submodules": [
      "Compliance",
      "Customs",
      "Risk Management",
      "Trade Preference"
    ],
    "active": true
  },
  {
    "code": "QM",
    "name": "Quality Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Quality",
      "Inspection Lot"
    ],
    "submodules": [
      "Inspection Planning",
      "Quality Inspection",
      "Certificates",
      "Quality Notifications"
    ],
    "active": true
  },
  {
    "code": "CS",
    "name": "Customer Service",
    "category": "Logistics & SCM",
    "aliases": [
      "Customer Service",
      "Service Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "LO",
    "name": "Logistics General",
    "category": "Logistics & SCM",
    "aliases": [
      "Logistics",
      "LO"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "VC",
    "name": "Variant Configuration",
    "category": "Logistics & SCM",
    "aliases": [
      "Variant Configuration",
      "LO-VC",
      "Advanced Variant Configuration"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "HU",
    "name": "Handling Unit Management",
    "category": "Logistics & SCM",
    "aliases": [
      "Handling Unit",
      "HUM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PP",
    "name": "Production Planning",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Production",
      "Manufacturing",
      "MRP",
      "Plan to Produce",
      "PTP",
      "MTS",
      "MTO"
    ],
    "submodules": [
      "PP-PI",
      "MRP",
      "MRP Live",
      "Production Orders",
      "Process Orders",
      "Capacity Planning",
      "Repetitive Manufacturing"
    ],
    "active": true
  },
  {
    "code": "PP-PI",
    "name": "Production Planning for Process Industries",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Process Industry",
      "Process Orders",
      "PP PI"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "REM",
    "name": "Repetitive Manufacturing",
    "category": "Manufacturing & Assets",
    "aliases": [
      "REM",
      "Repetitive Manufacturing"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MTS",
    "name": "Make to Stock",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Make to Stock",
      "MTS"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MTO",
    "name": "Make to Order",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Make to Order",
      "MTO"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ETO",
    "name": "Engineer to Order",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Engineer to Order",
      "ETO"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PM",
    "name": "Plant Maintenance",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Plant Maintenance",
      "Maintenance",
      "EAM"
    ],
    "submodules": [
      "Preventive Maintenance",
      "Corrective Maintenance",
      "Maintenance Orders",
      "Notifications"
    ],
    "active": true
  },
  {
    "code": "EAM",
    "name": "Enterprise Asset Management",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Asset Management",
      "Plant Maintenance"
    ],
    "submodules": [
      "Asset Operations",
      "Maintenance Planning",
      "Linear Asset Management"
    ],
    "active": true
  },
  {
    "code": "PS",
    "name": "Project System",
    "category": "Manufacturing & Assets",
    "aliases": [
      "Project Systems",
      "WBS",
      "Project Management"
    ],
    "submodules": [
      "WBS",
      "Networks",
      "Project Budget",
      "Results Analysis"
    ],
    "active": true
  },
  {
    "code": "DMC",
    "name": "Digital Manufacturing Cloud",
    "category": "Manufacturing & Assets",
    "aliases": [
      "DMC",
      "SAP Digital Manufacturing",
      "ME/MII"
    ],
    "submodules": [
      "Shop Floor",
      "Manufacturing Execution",
      "MII"
    ],
    "active": true
  },
  {
    "code": "ME",
    "name": "Manufacturing Execution",
    "category": "Manufacturing & Assets",
    "aliases": [
      "SAP ME",
      "Manufacturing Execution"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "MII",
    "name": "Manufacturing Integration and Intelligence",
    "category": "Manufacturing & Assets",
    "aliases": [
      "SAP MII",
      "Manufacturing Intelligence"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PLM",
    "name": "Product Lifecycle Management",
    "category": "Manufacturing & Assets",
    "aliases": [
      "PLM",
      "Product Lifecycle"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PPDS",
    "name": "Production Planning and Detailed Scheduling",
    "category": "Manufacturing & Assets",
    "aliases": [
      "PP/DS",
      "PPDS",
      "Detailed Scheduling"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IBP",
    "name": "Integrated Business Planning",
    "category": "Procurement & Planning",
    "aliases": [
      "Integrated Business Planning",
      "Demand Planning",
      "Supply Planning",
      "IBP Response",
      "IBP S&OP"
    ],
    "submodules": [
      "Demand Planning",
      "Supply Planning",
      "S&OP",
      "Response and Supply",
      "Inventory Optimization"
    ],
    "active": true
  },
  {
    "code": "APO",
    "name": "Advanced Planning and Optimization",
    "category": "Procurement & Planning",
    "aliases": [
      "Advanced Planning",
      "DP",
      "SNP",
      "PPDS"
    ],
    "submodules": [
      "DP",
      "SNP",
      "PP/DS",
      "GATP"
    ],
    "active": true
  },
  {
    "code": "Ariba",
    "name": "SAP Ariba",
    "category": "Procurement & Planning",
    "aliases": [
      "Ariba Sourcing",
      "Ariba Buying",
      "Ariba Network",
      "S2P",
      "Source to Pay",
      "Source to Contract"
    ],
    "submodules": [
      "Sourcing",
      "Buying",
      "Contracts",
      "Supplier Lifecycle",
      "Ariba Network"
    ],
    "active": true
  },
  {
    "code": "ARIBA-SLP",
    "name": "Ariba Supplier Lifecycle and Performance",
    "category": "Procurement & Planning",
    "aliases": [
      "SLP",
      "Supplier Lifecycle"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ARIBA-SOURCING",
    "name": "Ariba Sourcing",
    "category": "Procurement & Planning",
    "aliases": [
      "Ariba Sourcing",
      "Source to Contract"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ARIBA-CONTRACTS",
    "name": "Ariba Contracts",
    "category": "Procurement & Planning",
    "aliases": [
      "Ariba Contracts",
      "CLM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ARIBA-BUYING",
    "name": "Ariba Buying and Invoicing",
    "category": "Procurement & Planning",
    "aliases": [
      "Buying and Invoicing",
      "Guided Buying"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SRM",
    "name": "Supplier Relationship Management",
    "category": "Procurement & Planning",
    "aliases": [
      "SAP SRM",
      "Supplier Relationship",
      "Sourcing"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CLM",
    "name": "Contract Lifecycle Management",
    "category": "Procurement & Planning",
    "aliases": [
      "Contract Lifecycle",
      "CLM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ABAP",
    "name": "Advanced Business Application Programming",
    "category": "Technology",
    "aliases": [
      "ABAP OO",
      "Developer",
      "Development",
      "RICEFW",
      "WRICEF"
    ],
    "submodules": [
      "ABAP OO",
      "CDS",
      "AMDP",
      "BAPI",
      "BADI",
      "Enhancement",
      "Forms",
      "Reports",
      "Interfaces"
    ],
    "active": true
  },
  {
    "code": "BASIS",
    "name": "SAP Basis / Technical Administration",
    "category": "Technology",
    "aliases": [
      "Basis",
      "NetWeaver",
      "SAP Technical",
      "System Administration",
      "HANA Admin"
    ],
    "submodules": [
      "Transport",
      "Client Copy",
      "System Refresh",
      "Kernel Upgrade",
      "HANA Administration",
      "S/4 Conversion Technical"
    ],
    "active": true
  },
  {
    "code": "Security",
    "name": "SAP Security & Authorizations",
    "category": "Technology",
    "aliases": [
      "Authorization",
      "Roles",
      "PFCG",
      "User Administration"
    ],
    "submodules": [
      "Roles",
      "PFCG",
      "User Administration",
      "SoD",
      "GRC Access Control"
    ],
    "active": true
  },
  {
    "code": "GRC",
    "name": "Governance Risk and Compliance",
    "category": "Technology",
    "aliases": [
      "Access Control",
      "Risk Management",
      "Process Control"
    ],
    "submodules": [
      "Access Control",
      "Risk Analysis",
      "Emergency Access",
      "Process Control"
    ],
    "active": true
  },
  {
    "code": "BTP",
    "name": "Business Technology Platform",
    "category": "Technology",
    "aliases": [
      "SAP BTP",
      "Extension Suite",
      "Integration Suite"
    ],
    "submodules": [
      "CPI",
      "Integration Suite",
      "CAP",
      "RAP",
      "Event Mesh",
      "Build Apps",
      "Build Process Automation"
    ],
    "active": true
  },
  {
    "code": "CPI",
    "name": "Cloud Platform Integration",
    "category": "Technology",
    "aliases": [
      "SAP CPI",
      "Cloud Integration",
      "Integration Suite"
    ],
    "submodules": [
      "iFlow",
      "API Management",
      "Event Mesh",
      "Open Connectors"
    ],
    "active": true
  },
  {
    "code": "PI/PO",
    "name": "Process Integration / Process Orchestration",
    "category": "Technology",
    "aliases": [
      "PI PO",
      "Process Integration",
      "Process Orchestration",
      "XI"
    ],
    "submodules": [
      "Adapters",
      "Mappings",
      "IDoc",
      "Proxy",
      "B2B"
    ],
    "active": true
  },
  {
    "code": "FIORI",
    "name": "SAP Fiori",
    "category": "Technology",
    "aliases": [
      "Fiori",
      "Launchpad",
      "UX"
    ],
    "submodules": [
      "Fiori Launchpad",
      "Fiori Elements",
      "Smart Controls"
    ],
    "active": true
  },
  {
    "code": "UI5",
    "name": "SAPUI5",
    "category": "Technology",
    "aliases": [
      "UI5",
      "SAP UI5",
      "Frontend"
    ],
    "submodules": [
      "SAPUI5",
      "OpenUI5",
      "Fiori Apps"
    ],
    "active": true
  },
  {
    "code": "MDG",
    "name": "Master Data Governance",
    "category": "Technology",
    "aliases": [
      "Master Data Governance",
      "MDM"
    ],
    "submodules": [
      "Material",
      "Customer",
      "Supplier",
      "Finance",
      "Data Replication"
    ],
    "active": true
  },
  {
    "code": "WRICEF",
    "name": "Workflow Reports Interfaces Conversions Enhancements Forms",
    "category": "Technology",
    "aliases": [
      "RICEFW",
      "WRICEF",
      "Reports Interfaces Conversions Enhancements Forms"
    ],
    "submodules": [
      "Reports",
      "Interfaces",
      "Conversions",
      "Enhancements",
      "Forms",
      "Workflow"
    ],
    "active": true
  },
  {
    "code": "RAP",
    "name": "RESTful ABAP Programming Model",
    "category": "Technology",
    "aliases": [
      "RAP",
      "ABAP RESTful",
      "RESTful ABAP"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CAP",
    "name": "Cloud Application Programming Model",
    "category": "Technology",
    "aliases": [
      "CAP",
      "SAP CAP",
      "Cloud Application Programming"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CDS",
    "name": "Core Data Services",
    "category": "Technology",
    "aliases": [
      "CDS Views",
      "Core Data Services"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "AMDP",
    "name": "ABAP Managed Database Procedures",
    "category": "Technology",
    "aliases": [
      "AMDP",
      "SQLScript"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IDOC",
    "name": "Intermediate Document",
    "category": "Technology",
    "aliases": [
      "IDoc",
      "IDOC",
      "EDI"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ALE",
    "name": "Application Link Enabling",
    "category": "Technology",
    "aliases": [
      "ALE",
      "IDoc Integration"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Workflow",
    "name": "SAP Business Workflow",
    "category": "Technology",
    "aliases": [
      "Workflow",
      "Business Workflow"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "BRF+",
    "name": "Business Rule Framework Plus",
    "category": "Technology",
    "aliases": [
      "BRF+",
      "BRFplus",
      "Business Rules"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Solution Manager",
    "name": "SAP Solution Manager",
    "category": "Technology",
    "aliases": [
      "SolMan",
      "Solution Manager"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Cloud ALM",
    "name": "SAP Cloud ALM",
    "category": "Technology",
    "aliases": [
      "Cloud ALM",
      "CALM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Signavio",
    "name": "SAP Signavio",
    "category": "Technology",
    "aliases": [
      "Signavio",
      "Process Intelligence",
      "Process Mining"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Build Apps",
    "name": "SAP Build Apps",
    "category": "Technology",
    "aliases": [
      "Build Apps",
      "AppGyver"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Build Process Automation",
    "name": "SAP Build Process Automation",
    "category": "Technology",
    "aliases": [
      "Build Process Automation",
      "Workflow Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Event Mesh",
    "name": "SAP Event Mesh",
    "category": "Technology",
    "aliases": [
      "Event Mesh",
      "Event Driven"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "API Management",
    "name": "SAP API Management",
    "category": "Technology",
    "aliases": [
      "API Management",
      "API Portal"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Data Intelligence",
    "name": "SAP Data Intelligence",
    "category": "Technology",
    "aliases": [
      "Data Intelligence",
      "Data Hub"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "LTMC",
    "name": "Legacy Transfer Migration Cockpit",
    "category": "Technology",
    "aliases": [
      "LTMC",
      "Migration Cockpit"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SLT",
    "name": "SAP Landscape Transformation",
    "category": "Technology",
    "aliases": [
      "SLT",
      "Landscape Transformation",
      "Replication Server"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SNP CrystalBridge",
    "name": "SNP CrystalBridge",
    "category": "Technology",
    "aliases": [
      "CrystalBridge",
      "Bluefield",
      "Selective Data Transition"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "HANA",
    "name": "SAP HANA",
    "category": "Data & Analytics",
    "aliases": [
      "HANA DB",
      "HANA Modeling",
      "In-memory database"
    ],
    "submodules": [
      "HANA DB",
      "Calculation Views",
      "SQLScript",
      "Performance Tuning"
    ],
    "active": true
  },
  {
    "code": "BW",
    "name": "Business Warehouse",
    "category": "Data & Analytics",
    "aliases": [
      "SAP BW",
      "Business Warehouse",
      "BI"
    ],
    "submodules": [
      "BW Extractors",
      "BEx",
      "InfoCubes",
      "DSO",
      "CompositeProvider"
    ],
    "active": true
  },
  {
    "code": "BW/4HANA",
    "name": "Business Warehouse/4HANA",
    "category": "Data & Analytics",
    "aliases": [
      "BW4HANA",
      "BW 4HANA"
    ],
    "submodules": [
      "ADSO",
      "CompositeProvider",
      "Open ODS",
      "BW Modeling"
    ],
    "active": true
  },
  {
    "code": "SAC",
    "name": "SAP Analytics Cloud",
    "category": "Data & Analytics",
    "aliases": [
      "Analytics Cloud",
      "SAC Planning",
      "SAP SAC"
    ],
    "submodules": [
      "Planning",
      "Stories",
      "Analytics Designer",
      "Predictive"
    ],
    "active": true
  },
  {
    "code": "Datasphere",
    "name": "SAP Datasphere",
    "category": "Data & Analytics",
    "aliases": [
      "Data Warehouse Cloud",
      "DWC",
      "DTS"
    ],
    "submodules": [
      "Spaces",
      "Data Builder",
      "Business Builder",
      "Replication Flow"
    ],
    "active": true
  },
  {
    "code": "BOBJ",
    "name": "BusinessObjects",
    "category": "Data & Analytics",
    "aliases": [
      "Business Objects",
      "BO",
      "WebI"
    ],
    "submodules": [
      "Web Intelligence",
      "Crystal Reports",
      "Universe Design"
    ],
    "active": true
  },
  {
    "code": "BODS",
    "name": "BusinessObjects Data Services",
    "category": "Data & Analytics",
    "aliases": [
      "Data Services",
      "SAP DS",
      "ETL"
    ],
    "submodules": [
      "ETL",
      "Data Quality",
      "Data Migration"
    ],
    "active": true
  },
  {
    "code": "PaPM",
    "name": "Profitability and Performance Management",
    "category": "Data & Analytics",
    "aliases": [
      "PaPM",
      "Performance Management",
      "Profitability Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "S/4 Embedded Analytics",
    "name": "S/4HANA Embedded Analytics",
    "category": "Data & Analytics",
    "aliases": [
      "Embedded Analytics",
      "S4 Embedded Analytics"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Analytics Cloud Planning",
    "name": "SAC Planning",
    "category": "Data & Analytics",
    "aliases": [
      "SAC Planning",
      "Planning Model"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "DWC",
    "name": "Data Warehouse Cloud",
    "category": "Data & Analytics",
    "aliases": [
      "DWC",
      "SAP DWC",
      "Datasphere"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Lumira",
    "name": "SAP Lumira",
    "category": "Data & Analytics",
    "aliases": [
      "Lumira",
      "Design Studio"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Crystal Reports",
    "name": "SAP Crystal Reports",
    "category": "Data & Analytics",
    "aliases": [
      "Crystal Reports"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SuccessFactors",
    "name": "SAP SuccessFactors",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Success Factors",
      "SF",
      "HXM"
    ],
    "submodules": [
      "Employee Central",
      "Recruiting",
      "Onboarding",
      "PMGM",
      "LMS",
      "Compensation",
      "Time",
      "Payroll"
    ],
    "active": true
  },
  {
    "code": "EC",
    "name": "SuccessFactors Employee Central",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Employee Central",
      "SF EC",
      "EC Core",
      "Hire to Retire",
      "H2R"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ECP",
    "name": "SuccessFactors Employee Central Payroll",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Employee Central Payroll",
      "SF Payroll",
      "ECP"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "RCM",
    "name": "SuccessFactors Recruiting Management",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Recruiting Management",
      "RCM",
      "Recruiting"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "RMK",
    "name": "SuccessFactors Recruiting Marketing",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Recruiting Marketing",
      "RMK"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ONB",
    "name": "SuccessFactors Onboarding",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Onboarding",
      "ONB",
      "ONB 2.0"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "LMS",
    "name": "SuccessFactors Learning Management",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Learning",
      "Learning Management",
      "LMS"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "PMGM",
    "name": "SuccessFactors Performance and Goals",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Performance and Goals",
      "PMGM",
      "Goals"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "COMP",
    "name": "SuccessFactors Compensation",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Compensation",
      "Variable Pay",
      "Comp"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Time Tracking",
    "name": "SuccessFactors Time Tracking",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Time Tracking",
      "Time Sheet",
      "Time Off"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CDP",
    "name": "SuccessFactors Career Development Planning",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "CDP",
      "Career Development"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "WFA",
    "name": "SuccessFactors Workforce Analytics",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Workforce Analytics",
      "WFA"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "WFP",
    "name": "SuccessFactors Workforce Planning",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Workforce Planning",
      "WFP"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Employee Experience",
    "name": "SAP Qualtrics Employee Experience",
    "category": "SuccessFactors / HXM",
    "aliases": [
      "Qualtrics EX",
      "Employee Experience"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Concur",
    "name": "SAP Concur",
    "category": "Cloud / LoB",
    "aliases": [
      "Travel and Expense",
      "Expense Management"
    ],
    "submodules": [
      "Expense",
      "Travel",
      "Invoice"
    ],
    "active": true
  },
  {
    "code": "Fieldglass",
    "name": "SAP Fieldglass",
    "category": "Cloud / LoB",
    "aliases": [
      "External Workforce",
      "Vendor Management"
    ],
    "submodules": [
      "Contingent Workforce",
      "Services Procurement"
    ],
    "active": true
  },
  {
    "code": "CX",
    "name": "SAP Customer Experience",
    "category": "Cloud / LoB",
    "aliases": [
      "C/4HANA",
      "SAP CX"
    ],
    "submodules": [
      "Sales Cloud",
      "Service Cloud",
      "Marketing Cloud",
      "Commerce Cloud",
      "Customer Data Cloud"
    ],
    "active": true
  },
  {
    "code": "CRM",
    "name": "Customer Relationship Management",
    "category": "Cloud / LoB",
    "aliases": [
      "SAP CRM",
      "Customer Relationship",
      "Lead to Cash",
      "L2C"
    ],
    "submodules": [
      "Sales",
      "Service",
      "Marketing",
      "Interaction Center"
    ],
    "active": true
  },
  {
    "code": "Commerce",
    "name": "SAP Commerce Cloud",
    "category": "Cloud / LoB",
    "aliases": [
      "Hybris",
      "Commerce Cloud",
      "SAP Commerce"
    ],
    "submodules": [
      "B2B Commerce",
      "B2C Commerce",
      "Backoffice",
      "SmartEdit"
    ],
    "active": true
  },
  {
    "code": "Sales Cloud",
    "name": "SAP Sales Cloud",
    "category": "Cloud / LoB",
    "aliases": [
      "C4C Sales",
      "Cloud for Customer"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Service Cloud",
    "name": "SAP Service Cloud",
    "category": "Cloud / LoB",
    "aliases": [
      "C4C Service",
      "Service Cloud"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Marketing Cloud",
    "name": "SAP Marketing Cloud",
    "category": "Cloud / LoB",
    "aliases": [
      "Hybris Marketing",
      "Marketing Cloud"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CDC",
    "name": "Customer Data Cloud",
    "category": "Cloud / LoB",
    "aliases": [
      "Gigya",
      "Customer Data Cloud",
      "CDC"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Emarsys",
    "name": "SAP Emarsys",
    "category": "Cloud / LoB",
    "aliases": [
      "Emarsys",
      "Marketing Automation"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CPQ",
    "name": "SAP CPQ",
    "category": "Cloud / LoB",
    "aliases": [
      "Configure Price Quote",
      "CPQ"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-U",
    "name": "Industry Solution Utilities",
    "category": "Industry Solutions",
    "aliases": [
      "ISU",
      "Utilities",
      "SAP Utilities"
    ],
    "submodules": [
      "Billing",
      "Device Management",
      "FICA",
      "Market Communication"
    ],
    "active": true
  },
  {
    "code": "IS-OIL",
    "name": "Industry Solution Oil & Gas",
    "category": "Industry Solutions",
    "aliases": [
      "IS Oil",
      "Oil and Gas",
      "Downstream"
    ],
    "submodules": [
      "TD",
      "HPM",
      "TSW",
      "JVA"
    ],
    "active": true
  },
  {
    "code": "IS-Retail",
    "name": "Industry Solution Retail",
    "category": "Industry Solutions",
    "aliases": [
      "Retail",
      "SAP Retail"
    ],
    "submodules": [
      "Merchandise Management",
      "Article Master",
      "Assortment",
      "Pricing"
    ],
    "active": true
  },
  {
    "code": "FS-CD",
    "name": "Financial Services Collections and Disbursements",
    "category": "Industry Solutions",
    "aliases": [
      "FSCD",
      "Insurance Collections"
    ],
    "submodules": [
      "Collections",
      "Disbursements",
      "Open Item Accounting"
    ],
    "active": true
  },
  {
    "code": "IS-Banking",
    "name": "Industry Solution Banking",
    "category": "Industry Solutions",
    "aliases": [
      "SAP Banking",
      "Banking Services"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FS-CML",
    "name": "Consumer and Mortgage Loans",
    "category": "Industry Solutions",
    "aliases": [
      "CML",
      "Loans Management"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FS-PM",
    "name": "Policy Management",
    "category": "Industry Solutions",
    "aliases": [
      "Insurance Policy Management",
      "FS PM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-AUTO",
    "name": "Industry Solution Automotive",
    "category": "Industry Solutions",
    "aliases": [
      "SAP Automotive",
      "Auto"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-MILL",
    "name": "Industry Solution Mill Products",
    "category": "Industry Solutions",
    "aliases": [
      "Mill Products",
      "IS Mill"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-MINING",
    "name": "Industry Solution Mining",
    "category": "Industry Solutions",
    "aliases": [
      "Mining",
      "SAP Mining"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-MEDIA",
    "name": "Industry Solution Media",
    "category": "Industry Solutions",
    "aliases": [
      "Media",
      "SAP Media"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-TELCO",
    "name": "Industry Solution Telecommunications",
    "category": "Industry Solutions",
    "aliases": [
      "Telecom",
      "Telco",
      "SAP Telecom"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-H",
    "name": "Industry Solution Healthcare",
    "category": "Industry Solutions",
    "aliases": [
      "SAP Healthcare",
      "Hospital"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "IS-PS",
    "name": "Industry Solution Public Sector",
    "category": "Industry Solutions",
    "aliases": [
      "Public Sector",
      "Government"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FICA",
    "name": "Contract Accounts Receivable and Payable",
    "category": "Industry Solutions",
    "aliases": [
      "FI-CA",
      "FICA",
      "Contract Accounting"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "JVA",
    "name": "Joint Venture Accounting",
    "category": "Finance",
    "aliases": [
      "Joint Venture Accounting",
      "JVA"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ETD",
    "name": "Exposure Management",
    "category": "Finance",
    "aliases": [
      "Exposure Management",
      "ETD"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FPSL",
    "name": "Financial Products Subledger",
    "category": "Finance",
    "aliases": [
      "Financial Products Subledger",
      "FPSL"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "AFS",
    "name": "Apparel and Footwear Solution",
    "category": "Industry Solutions",
    "aliases": [
      "Apparel and Footwear Solution",
      "AFS"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "VIM",
    "name": "Vendor Invoice Management",
    "category": "Technology",
    "aliases": [
      "Vendor Invoice Management",
      "VIM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "OpenText VIM",
    "name": "OpenText Vendor Invoice Management",
    "category": "Technology",
    "aliases": [
      "OpenText Vendor Invoice Management",
      "OpenText VIM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "DMS",
    "name": "Document Management System",
    "category": "Technology",
    "aliases": [
      "Document Management System",
      "DMS"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ILM",
    "name": "Information Lifecycle Management",
    "category": "Technology",
    "aliases": [
      "Information Lifecycle Management",
      "ILM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Archiving",
    "name": "SAP Data Archiving",
    "category": "Technology",
    "aliases": [
      "SAP Data Archiving",
      "Archiving"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "S4HANA",
    "name": "SAP S/4HANA",
    "category": "Technology",
    "aliases": [
      "SAP S/4HANA",
      "S4HANA"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "ECC",
    "name": "SAP ECC",
    "category": "Technology",
    "aliases": [
      "SAP ECC",
      "ECC"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Rise",
    "name": "RISE with SAP",
    "category": "Cloud / LoB",
    "aliases": [
      "RISE with SAP",
      "Rise"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Grow",
    "name": "GROW with SAP",
    "category": "Cloud / LoB",
    "aliases": [
      "GROW with SAP",
      "Grow"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SCT",
    "name": "Source to Contract",
    "category": "Procurement & Planning",
    "aliases": [
      "Source to Contract",
      "SCT"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Q2C",
    "name": "Quote to Cash",
    "category": "Logistics & SCM",
    "aliases": [
      "Quote to Cash",
      "Q2C"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "BRIM",
    "name": "Billing and Revenue Innovation Management",
    "category": "Cloud / LoB",
    "aliases": [
      "Billing and Revenue Innovation Management",
      "BRIM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CI",
    "name": "Convergent Invoicing",
    "category": "Cloud / LoB",
    "aliases": [
      "Convergent Invoicing",
      "CI"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "CC",
    "name": "Convergent Charging",
    "category": "Cloud / LoB",
    "aliases": [
      "Convergent Charging",
      "CC"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "SOM",
    "name": "Subscription Order Management",
    "category": "Cloud / LoB",
    "aliases": [
      "Subscription Order Management",
      "SOM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "FSM",
    "name": "Field Service Management",
    "category": "Cloud / LoB",
    "aliases": [
      "Field Service Management",
      "FSM"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Asset Manager",
    "name": "SAP Asset Manager",
    "category": "Manufacturing & Assets",
    "aliases": [
      "SAP Asset Manager",
      "Asset Manager"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Mobile Start",
    "name": "SAP Mobile Start",
    "category": "Technology",
    "aliases": [
      "SAP Mobile Start",
      "Mobile Start"
    ],
    "submodules": [],
    "active": true
  },
  {
    "code": "Joule",
    "name": "SAP Joule",
    "category": "Technology",
    "aliases": [
      "SAP Joule",
      "Joule"
    ],
    "submodules": [],
    "active": true
  }
];

export const SAP_TAXONOMY_SEED_COUNT = SAP_TAXONOMY_SEED.length;
