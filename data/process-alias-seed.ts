export const PROCESS_ALIAS_SEED: Record<string, string[]> = {
  "OTC": [
    "SD"
  ],
  "O2C": [
    "SD"
  ],
  "ORDER TO CASH": [
    "SD"
  ],
  "ORDER 2 CASH": [
    "SD"
  ],
  "QUOTE TO CASH": [
    "SD",
    "CPQ"
  ],
  "Q2C": [
    "SD",
    "CPQ"
  ],
  "LEAD TO CASH": [
    "SD",
    "CRM"
  ],
  "L2C": [
    "SD",
    "CRM"
  ],
  "P2P": [
    "MM"
  ],
  "PTP": [
    "MM"
  ],
  "PROCURE TO PAY": [
    "MM"
  ],
  "PURCHASE TO PAY": [
    "MM"
  ],
  "SOURCE TO PAY": [
    "Ariba",
    "MM"
  ],
  "S2P": [
    "Ariba",
    "MM"
  ],
  "SOURCE TO CONTRACT": [
    "Ariba",
    "MM"
  ],
  "S2C": [
    "Ariba",
    "MM"
  ],
  "RTR": [
    "FICO"
  ],
  "R2R": [
    "FICO"
  ],
  "RECORD TO REPORT": [
    "FICO"
  ],
  "RECORD 2 REPORT": [
    "FICO"
  ],
  "ACQUIRE TO RETIRE": [
    "FI-AA"
  ],
  "A2R": [
    "FI-AA"
  ],
  "PLAN TO PRODUCE": [
    "PP"
  ],
  "P2M": [
    "PP"
  ],
  "MAKE TO STOCK": [
    "PP",
    "MTS"
  ],
  "MTS": [
    "PP"
  ],
  "MAKE TO ORDER": [
    "PP",
    "MTO"
  ],
  "MTO": [
    "PP"
  ],
  "ENGINEER TO ORDER": [
    "PS",
    "PP",
    "ETO"
  ],
  "ETO": [
    "PS",
    "PP"
  ],
  "HIRE TO RETIRE": [
    "SuccessFactors",
    "EC"
  ],
  "H2R": [
    "SuccessFactors",
    "EC"
  ],
  "HIRE TO REHIRE": [
    "SuccessFactors",
    "EC"
  ],
  "RECRUIT TO RETIRE": [
    "SuccessFactors",
    "RCM",
    "EC"
  ],
  "WAREHOUSE": [
    "EWM",
    "WM"
  ],
  "TRANSPORTATION": [
    "TM"
  ],
  "DESIGN TO OPERATE": [
    "PP",
    "PM",
    "EAM",
    "DMC"
  ],
  "D2O": [
    "PP",
    "PM",
    "EAM"
  ],
  "REQUEST TO RESOLVE": [
    "PM",
    "CS"
  ],
  "SERVICE TO CASH": [
    "CS",
    "SD"
  ],
  "CASH MANAGEMENT": [
    "TRM"
  ],
  "CENTRAL FINANCE": [
    "CFIN",
    "FICO"
  ],
  "CFIN": [
    "CFIN",
    "FICO"
  ],
  "GROUP REPORTING": [
    "GR"
  ],
  "FINANCIAL CLOSE": [
    "GR",
    "FICO"
  ],
  "SELECTIVE DATA TRANSITION": [
    "SNP CrystalBridge",
    "SLT"
  ],
  "BLUEFIELD": [
    "SNP CrystalBridge",
    "SLT"
  ],
  "BROWNFIELD": [
    "S4HANA",
    "BASIS"
  ],
  "GREENFIELD": [
    "S4HANA"
  ],
  "ROLL OUT": [
    "S4HANA"
  ],
  "ROLLOUT": [
    "S4HANA"
  ],
  "INTEGRATION SUITE": [
    "BTP",
    "CPI"
  ],
  "SAP BTP INTEGRATION": [
    "BTP",
    "CPI"
  ],
  "DATA TO VALUE": [
    "Datasphere",
    "SAC",
    "BW/4HANA"
  ],
  "DTS": [
    "Datasphere"
  ],
  "REVENUE TO CASH": [
    "BRIM",
    "FI-AR",
    "SD"
  ],
  "FSCM": [
    "FSCM",
    "FICO"
  ],
  "FINANCIAL SUPPLY CHAIN MANAGEMENT": [
    "FSCM",
    "FICO"
  ],
  "TRM": [
    "TRM",
    "FSCM",
    "FICO"
  ],
  "TREASURY": [
    "TRM",
    "FSCM",
    "FICO"
  ],
  "TREASURY MANAGEMENT": [
    "TRM",
    "FSCM",
    "FICO"
  ],
  "CREDIT MANAGEMENT": [
    "FSCM",
    "FI-AR",
    "FICO"
  ],
  "COLLECTIONS": [
    "FSCM",
    "FI-AR",
    "FICO"
  ],
  "COLLECTIONS MANAGEMENT": [
    "FSCM",
    "FI-AR",
    "FICO"
  ],
  "DISPUTE MANAGEMENT": [
    "FSCM",
    "FI-AR",
    "FICO"
  ],
  "BILLER DIRECT": [
    "FSCM",
    "FI-AR"
  ],
  "BANK COMMUNICATION MANAGEMENT": [
    "BCM",
    "TRM"
  ],
  "BCM": [
    "BCM",
    "TRM"
  ],
  "IN HOUSE CASH": [
    "IHC",
    "TRM"
  ],
  "IHC": [
    "IHC",
    "TRM"
  ],
  "LIQUIDITY MANAGEMENT": [
    "TRM",
    "Cash Management"
  ],
  "CASH POSITION": [
    "TRM",
    "Cash Management"
  ],
  "SUPPLY CHAIN MANAGEMENT": [
    "MM",
    "SD",
    "PP",
    "EWM",
    "TM",
    "IBP",
    "APO"
  ],
  "SCM": [
    "MM",
    "SD",
    "PP",
    "EWM",
    "TM",
    "IBP",
    "APO"
  ],
  "LOGISTICS": [
    "MM",
    "SD",
    "EWM",
    "TM",
    "WM",
    "LE"
  ],
  "SAP LOGISTICS": [
    "MM",
    "SD",
    "EWM",
    "TM",
    "WM",
    "LE"
  ],
  "CUTOVER": [
    "S4HANA",
    "Implementation"
  ],
  "HYPERCARE": [
    "S4HANA",
    "AMS"
  ],
  "IMPLEMENTATION": [
    "S4HANA"
  ],
  "IMPELEMENTATION": [
    "S4HANA"
  ],
  "MIGRATION": [
    "S4HANA",
    "LTMC",
    "Migration Cockpit"
  ],
  "UPGRADE": [
    "BASIS",
    "S4HANA"
  ],
  "AMS": [
    "AMS",
    "Support"
  ],
  "SUPPORT": [
    "AMS",
    "Support"
  ]
};

export const PROCESS_ALIAS_SEED_COUNT = Object.keys(PROCESS_ALIAS_SEED).length;
