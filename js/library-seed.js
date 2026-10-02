// Starter AOM Library: the 14 templates from the Barangay Audit System workbook (AOM_Pool sheet).
export const POOL_SEED = [
 {
  "code": "OBS-001",
  "title": "Delayed Remittance",
  "area": "Cash and Cash Equivalents",
  "wp": "WP-CASH01",
  "section": "A",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "Collections amounting to [TOTAL_DELAYED_AMOUNT] were not deposited intact within the prescribed period, with delays ranging from [MIN_DELAY_DAYS] to [MAX_DELAY_DAYS] days, exposing barangay funds to possible loss, theft, or misuse, contrary to Section 4.1.12 of the Manual on the Financial Management of Barangays."
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "Section 4.1.12 of the Manual on the Financial Management of Barangays provides that collections accruing to the barangay shall be deposited intact daily. Where travel time to the depository bank is more than one day, deposit shall be made at least once a week or as soon as collections reach ₱5,000.00. Collections shall be deposited with the Authorized Government Depository Bank account maintained in the name of the barangay.",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "Examination of the cash and accounts of the Barangay Treasurer disclosed that [NO_OF_DELAYED_TRANSACTIONS] deposit transaction/s involving collections totaling [TOTAL_DELAYED_AMOUNT] were deposited only after delays ranging from [MIN_DELAY_DAYS] to [MAX_DELAY_DAYS] days from collection."
   },
   {
    "type": "cause",
    "text": "The delays were attributable to the practice of depositing collections only after the accountable form/booklet had been fully consumed or issued, instead of depositing based on the prescribed frequency and amount threshold."
   },
   {
    "type": "effect",
    "text": "The delayed deposit caused collections amounting to [TOTAL_DELAYED_AMOUNT] to remain in the custody of the Barangay Treasurer beyond the prescribed period, thereby increasing the exposure of barangay funds to possible loss, theft, misuse, or other irregular disposition."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that the Punong Barangay instruct the Barangay Treasurer to deposit intact daily all collections with the Authorized Government Depository Bank. Where travel time to the depository bank is more than one day, deposits should be made at least once a week or as soon as collections reach ₱5,000.00."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-002",
  "title": "Unliquidated Cash Advances",
  "area": "Cash Advances",
  "wp": "WP-CA01",
  "section": "A",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "Cash advances in the total amount of ₱[TOTAL_UNLIQ_CA] remained outstanding at year-end, contrary to Section 89 of P.D. No. 1445 and Chapter 5, Sections 5.1.7 and 5.1.8 of the Manual on Financial Management for Barangays, resulting in the accumulation thereof."
   },
   {
    "type": "criteria",
    "lead": "Section 89 of P.D. No. 1445 provides that:",
    "text": "No cash advance shall be given unless for a legally authorized specific purpose. A cash advance shall be reported on and liquidated as soon as the purpose for which it was given has been served. No additional cash advance shall be allowed to any official or employee unless the previous cash advance given him is first settled or a proper accounting thereof is made.",
    "quoted": true
   },
   {
    "type": "criteria",
    "lead": "Furthermore, Chapter 5, Sections 5.1.7 and 5.1.8 of the Manual on Financial Management for Barangays state that:",
    "text": "5.1.7 All cash advances shall be liquidated at year-end. No additional cash advances shall be given to any official or employee unless the previous cash advance is liquidated and accounted for in the books.\n5.1.8 A cash advance shall be liquidated/reported as soon as the purpose for which it was granted has been served.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Our audit disclosed the following:"
   },
   {
    "type": "table",
    "n": 1
   },
   {
    "type": "cause",
    "text": "The unliquidated balances were mainly due to the failure of the Barangay Treasurer and other barangay officials to submit the required liquidation reports even after the purposes of their cash advances had been served, compounded by the absence of adequate monitoring of outstanding cash advances by the Barangay."
   },
   {
    "type": "effect",
    "text": "It was also noted that these cash advance existed for more than two years. As a result, the recording of relative expenses during the year it was incurred were not properly recognized resulting to the understatement of the expense accounts and an overstatement of the income account as well as continuous accumulation thereof for cash advances that were not actually utilized."
   },
   {
    "type": "recommendation",
    "lead": "We recommend that Management:",
    "items": [
     "Demand from all concerned officials for the immediate liquidation of these outstanding cash advances. If necessary, deduct from the terminal leave pay of the officials concerned;",
     "Desist from granting additional cash advances, unless the previous cash advances have been settled; and",
     "Comply strictly with the above-mentioned provisions on the granting, utilization and liquidation of cash advances."
    ],
    "text": ""
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-003",
  "title": "Unreliable PPE",
  "area": "Property, Plant and Equipment",
  "wp": "WP-PPE01",
  "section": "A",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The accuracy, validity, and existence of the Property, Plant, and Equipment (PPE) account amounting to [PPE_BALANCE] could not be ascertained due to: (a) the absence of a physical inventory count; and (b) incomplete documentation, in violation of Chapter VII of the Manual on Financial Management of Barangays prescribed for use by COA Circular 2015-011 dated December 1, 2015, thereby casting doubt on the reliability of the presented PPE account in the financial statements."
   },
   {
    "type": "criteria",
    "lead": "Chapter VII of the Manual on Financial Management of Barangays prescribed for use by COA Circular 2015-011 dated December 1, 2015 states that:",
    "text": "7.1 Specific Policies\nProperty, Plant and Equipment/Infrastructure Assets\n7.1.1 Property/Equipment Card(PEC), see Annex 26, shall be maintained for all property and equipment of the barangay by the BT.\n7.1.2 Property/Equipment Ledger Card (PELC), see Annex 26.1, shall be maintained by the C/M Accountant as subsidiary ledgers for all property and equipment of the barangay.\nXxx\n7.2.5.1 Inventory Taking and Reconciliation\na. The Inventory Committee headed by the PB or his authorized representative and the BT as his member shall conduct a physical count of all property and equipment of the barangay at least once a year.\nb. The Inventory Committee, upon the completion of the physical count, shall prepare three copies of Report on Inventory of Property and Equipment (RIPE), as shown in Annex 30 and shall be approved by the PB. The RIPE shall be distributed as follows:\nOriginal  –  to COA Auditor through C/M Accountant\nDuplicate copy –  to the C/M Accountant\nTriplicate copy –  to the BT\nc. The RIPE shall be the basis of the C/M Accountant for reconciling the results of inventory with the PPE accounts.\nd. The RIPE shall be the basis of the BT for reconciling the equipment that should be covered by ICS with the actual file of ICS. xxx",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Physical inventory of PPEs serves as an internal control measure over the assets of the barangay. The non-conduct and non-reporting of physical inventory of barangay properties impair the assertion on the existence, condition, validity and propriety of barangay properties."
   },
   {
    "type": "cause",
    "text": "Per review of the financial statements of the barangay, it showed that the property and equipment account had a total balance [PPE_BALANCE] for CY [AUDIT_YEAR].\nHowever, no report of Inventory of Property, Plant and Equipment was prepared and submitted to the Auditor’s Office. Also, the Barangay Treasurer had not prepared and maintained a Property/Equipment Card (PEC) for all property and equipment of the barangay and the Municipal Accountant had not prepared and maintained a Property/Equipment Ledger Card (PELC) which will serve as subsidiary ledgers for all property and equipment of the barangay."
   },
   {
    "type": "effect",
    "text": "The failure to conduct actual inventory of all properties owned by the barangay and the absence of registries for PPE cast doubt on the existence, condition and correctness of the reported PPE accounts in the financial statements.\nThe recorded depreciation expense was also doubtful due to the failure of the Management to identify the details or composition of the recorded PPE accounts, the dates of acquisition and cost, and establish the existence thereof."
   },
   {
    "type": "recommendation",
    "lead": "We recommend that:",
    "items": [
     "create a committee to conduct the annual physical inventory of all its PPE;",
     "prepare the Report on Inventory of Property and Equipment and submit a copy to the Auditor’s Office to validate the existence and condition of the PPEs;",
     "the Barangay Treasurer prepare and maintain a Property/Equipment Card (PEC) for all property and equipment of the barangay; and",
     "the Municipal Accountant prepare and maintain a Property/Equipment Ledger Card (PELC) which will serve as subsidiary ledgers for all property and equipment of the"
    ],
    "text": ""
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-004",
  "title": "Unremitted Taxes Withheld",
  "area": "Statutory Remittances",
  "wp": "WP-TAX01",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "Taxes withheld totaling [TOTAL_UNREMITTED_TAX] remained unremitted to the Bureau of Internal Revenue (BIR), contrary to Item B(4) of Revenue Memorandum Circular No. 23-2012 and Section 5(A) of Revenue Regulations No. 11-2018, thereby delaying the availability of funds held in trust for the government."
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "Item B (4) of RMC No. 23-2012 prescribes that, the government withholding agent should withhold tax on compensation, on income payments subject to expanded withholding tax and final withholding tax on government money payments to VAT-registered and non-VAT-registered taxpayer subject to percentage tax.\nFurther, said circular also requires the responsible officials and employees, as withholding tax agents, to see to it that taxes withheld are accordingly remitted on or before the 10th day of the following month for manual filers and 15th day of the following month for Electronic Filing Payment System (EFPS) filers.",
    "quoted": false
   },
   {
    "type": "criteria",
    "lead": "Section 5(A) of RR No. 11-2018 also provides that:",
    "text": "Taxpayers mandated to electronically file and pay shall use the BIR’s electronic system, while those not mandated has the option to either use the said electronic system, or file with the Authorized Agent Banks (AABs) under the jurisdiction of the Revenue District Office where they are registered. Withholding agents located at municipalities where there is no AAB, the returns shall be filed with the Revenue Collection Officer assigned in the said municipality. The filing of the withholding tax returns (BIR Form No. 1601EQ for creditable withholding tax and Form Nos. 1602 for final tax on interest on bank deposits, 1603 for final tax withheld on fringe benefits, and 1601FQ for all other final withholding taxes) and payment of the taxes withheld at source shall be made not later than the last day of the month following the close of the quarter during which the withholding was made. For this purpose, the quarter shall follow the calendar quarter, e.g., for taxes withheld during the quarter ending March 31, the same shall be remitted by the withholding agent on or before April 30. The return filed shall be accompanied by the Quarterly Alphabetical List of Payees (QAP), reflecting the name of income payees, Taxpayer Identification Number (TIN), the amount of income paid segregated per month with total for the quarter (all income payments prescribed as subject to withholding tax under these regulations, whether actually subjected to withholding tax or not subjected due to exemption), and the total amount of taxes withheld, if any. Considering that taxes withheld by the withholding agents are held in trust for the government and its availability is an imperious necessity to ensure sufficient cash inflow to the National Treasury, withholding agents shall file BIR Monthly Remittance Form (BIR Form No. 0619E and/or 0619F) every tenth (10th) day of the following month when the withholding is made, regardless of the amount withheld. For withholding agents using EFPS facility, the due date is on the fifteenth (15th) day of the following month. Withholding agents with zero remittance are still required to use and file the same form.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "As per records, the balance of the Due to BIR account as of December 31, [AUDIT_YEAR] is [TOTAL_UNREMITTED_TAX], of which none was remitted up to audit date. The balance of Due to BIR as of December 31, [AUDIT_YEAR] should only be the taxes withheld during the last month of the year if these were remitted regularly as required by the provisions of RMC No. 23-2012 and RR No. 11-2018."
   },
   {
    "type": "effect",
    "text": "The Barangay receives its share from national wealth thru the Internal Revenue Allotment (IRA), it is but proper to also do its part in remitting withheld taxes promptly and exactly. Consequently, the late remittance of taxes deprives the government of the use of the much-needed funds for its different programs and projects."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that the Barangay Treasurer remit immediately the unremitted taxes withheld. Henceforth, Management should ensure the prompt and correct remittance of taxes withheld to avoid unnecessary penalties. Unremitted taxes at year-end should only include the taxes withheld during the last month of the year."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-005",
  "title": "Non-submission of the Monthly Report on Sources and Utilization of DRRMF",
  "area": "5% BDRRMF",
  "wp": "",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The barangay failed to submit the Report on Sources and Utilization of the Barangay Disaster Risk Reduction and Management Fund contrary to Section 5.1.5 of COA Circular No. 2012-002 dated September 12, 2012."
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "COA Circular 2012-002 dated September 12, 2012 prescribes the rules on accounting and reporting of the Disaster Risk Reduction and Management Fund (DRRMF). Under Section 5.1.5 of said COA Circular, it requires that a Report on Sources and Utilization of DRRMF shall be prepared and certified correct by the Local Accountant.  The Local Disaster Risk Reduction and Management Officer (LDRRMO) shall submit the report on or before the 15th day after the end of each month through the LDRRMC and Local Development Council (LDC) to the COA Auditor of the LGU.",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "Based on records of the Office of the Auditor, no Report on Sources and Utilization of the Barangay Disaster Risk Reduction and Management Fund was ever submitted."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that the required reports on the sources and utilization of DRRMF from the Barangay DRRMO be regularly submitted pursuant to COA Circular No. 2012-002 dated September 12, 2012."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-006",
  "title": "FA (MOA)",
  "area": "Fund Transfers",
  "wp": "",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The efficiency, regularity and effectiveness of projects implemented thru fund transfers from/to National Government Agencies, Local Government Units (LGU’s), and Non-Governmental Organizations (NGOs)/ People’s Organizations (POs) cannot be not fully evaluated because the Office of the Auditor were not furnished with Memoranda of Agreement (MOA) / Trust Agreements and other pertinent documents to facilitate audit contrary to COA Circular No. 94-013, COA Circular No. 2007-001 and COA Circular 2012-001."
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "As an essential document needed for audit, COA Circular No. 94-013, COA Circular No. 2007-001 and COA Circular 2012-001 require that Memoranda of Agreement (MOA) / Trust Agreement and other supporting documents of Fund Transfers be furnished to the Office of the Auditor to serve as guide in audit.",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "However, based on our audit files, the Provincial Government of Quirino may have overlooked the task to furnish this Office with such essential documents for audit.  Thus, the efficiency, regularity and effectiveness of projects implemented from these fund transfers cannot be fully evaluated."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that Management  and other concerned personnel to submit the MOA and other supporting documents of all Fund Transfers to facilitate audit of these accounts."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-007",
  "title": "Non-submission of GAD Accomplishment Report",
  "area": "GAD",
  "wp": "",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The Barangay did not submit its GAD Accomplishment Report for CY 2025 which is not in accord with Item V of COA Circular 2014-001 and pertinent provisions of PCW-DILG-DBM-NEDA Joint Memorandum Circular No. 2013-01, thus programs, projects and activities related to GAD cannot be evaluated if they are parallel towards the realization of our country’s commitment, plan, and policies on women empowerment, gender equality, and gender development."
   },
   {
    "type": "criteria",
    "lead": "Item V of COA Circular 2014-001 sets Responsibility of the Audited Agency, and it provides:",
    "text": "The Audited Agency shall submit a copy of the Annual GAD Plan and Budget (GPB) to the COA Audit Team assigned to the agency within five (5) working days from the receipt of the approved plan from the PCW or their mother or central offices, as the case maybe. Likewise, a copy of the corresponding Accomplishment Report shall be furnished to the Audit Team within five (5) working days from the end of January of the preceding year.",
    "quoted": true
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "Pertinent provisions of the PCW-DILG-DBM-NEDA Joint Memorandum Circular No. 2013-01 requires the GAD Focal Point to prepare the annual GAD Plan and Budget (GPB) and the annual GAD Accomplishment Report of the LGU. The LGU GPB shall thereafter be submitted to the DILG Regional Office for review and approval. The DILG approved GPBs shall include a certificate of approval from the DILG Regional Offices which will be returned to the concerned LGUs for incorporation in their annual Budgets to be enacted by their Sanggunian.",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "Review of the reports submitted revealed that the barangay did not submit its GAD Accomplishment Report for CY 2025. The non-submission of this report cast doubt if the programs, projects, and activities were parallel towards the realization of our country’s commitment, plan, and policies on women empowerment, gender equality, and gender development. Also, it limits the Audit Team on determining the judicious use of the fund, and the efficiency and effectiveness of interventions in addressing gender issues."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommended that Management strictly adhere to the provisions of the above-cited Circulars by submitting the GAD Accomplishment Report to the Audit Team for the evaluation if the programs, projects and activities are directed towards the realization of our country’s commitment, plan, and policies on women empowerment, gender equality, and gender development."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-008",
  "title": "Irregular Procurement Through Reimbursements and Cash Advances",
  "area": "Procurement",
  "wp": "WP-PROC01",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "Procurement of goods and services and other maintenance and operating expenses (MOOE) through reimbursements and cash advances totaling [TOTAL_IRREGULAR_REIMBURSEMENTS] were considered irregular expenditures because these were made without adhering to established rules, regulations, procedural guidelines, policies, principles or practices that have gained recognition in laws contrary to COA Circular No. 2012-003 dated October 29, 2012."
   },
   {
    "type": "criteria",
    "lead": "COA Circular No. 2012-003 dated October 29, 2012 prescribes the Updated Guidelines for the Prevention and Disallowance of Irregular, Unnecessary, Excessive, Extravagant and Unconscionable Expenditures.  Section 3.1 of said Circular defines irregular expenditure as follows:",
    "text": "xxx\nIrregular expenditure signifies an expenditure incurred without adhering to established rules, regulations, procedural guidelines, policies, principles or practices that have gained recognition in laws. Irregular expenditures are incurred if funds are disbursed without conforming with prescribed usages and rules of discipline. There is no observance of an established pattern, course, and mode of action, behaviour, or conduct in the incurrence of an irregular expenditure. A transaction conducted in a manner that deviates or departs from, or which does not comply with standards set is deemed irregular. A transaction which fails to follow or violates appropriate rules of procedure is, likewise, irregular.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Audit disclosed that reimbursements and cash advances for the procurement of goods and services and other MOOE totaling [TOTAL_IRREGULAR_REIMBURSEMENTS] were made without compliance with the prescribed procurement procedures. The transactions were neither emergency procurements nor expenses arising from official travel. Details provided in Annex A."
   },
   {
    "type": "effect",
    "text": "Reimbursements and cash advances, while allowed as modes to facilitate payment in certain exceptional cases, are not considered as exceptions to the mandatory provisions of Republic Act No. 9184."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that Barangay Officials’ stop the practice of reimbursements and cash advances in connection to the procurement of goods and services and other MOOE without adhering to the provisions of RA No. 9184 in relation to COA Circular No. 2012-003."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-009",
  "title": "5% DRRM Fund Not Fully Utilized",
  "area": "5% BDRRMF",
  "wp": "WP-DRRM01",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The Barangay did not fully utilize its Disaster Risk Reduction Management Fund for CYs [AUDIT_PERIOD] contrary to Section 21 of RA 10121 or the Philippine Disaster Risk Reduction and Management Act of 2010 dated May 27, 2010, thus depriving the constituents of the benefit that could be derived from the utilization of the fund."
   },
   {
    "type": "criteria",
    "lead": "Section 21 of RA 10121 states that:",
    "text": "Local Disaster Risk Reduction and Management Fund (LDRRMF). – The present Local Calamity Fund shall henceforth be known as the Local Disaster Risk Reduction and Management Fund (LDRRMF). Not less than five percent (5%) of the estimated revenue from regular sources shall be set aside as the LDRRMF to support disaster risk management activities such as, but not limited to, pre-disaster preparedness programs including training, purchasing life-saving rescue equipment, supplies and medicines, for post-disaster activities, and for the payment of premiums on calamity insurance. The LDRRMC shall monitor and evaluate the use and disbursement of the LDRRMF based on the. LDRRMP as incorporated in the local development plans and annual work and financial plan. Upon the recommendation of the LDRRMO and approval of the sanggunian concerned, the LDRRMC may transfer the said fund to support disaster risk reduction work of other LDRRMCs which are declared under state of calamity.\nOf the amount appropriated for LDRRMF, thirty percent (30%) shall be allocated as Quick Response Fund (QRF) or stand-by fund for relief and recovery programs in order that situation and living conditions of people in communities or areas stricken by disasters, calamities, epidemics, or complex emergencies, may be normalized as quickly as possible.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Our review of the reports submitted revealed that the Barangay complied with the required five percent allocation of estimated revenues from regular sources by budgeting [LDRRMF_BUDGET_YR1], [LDRRMF_BUDGET_YR2], and [LDRRMF_BUDGET_YR3] for its DRRM Fund during CYs [AUDIT_PERIOD], respectively.\nAs per post-audit of the accounts of the Barangay, [PPA_IMPLEMENTED_YR1] out of [PPA_BUDGETED_YR1] budgeted programs, projects, and activities for the first year covered by the audit period were implemented, utilizing [DRRM_UTILIZED_YR1] or [DRRM_UTIL_RATE_YR1]% of the funds available for disaster prevention and mitigation, preparedness and response, and rehabilitation and recovery. Of the Quick Response Fund, [QRF_UTILIZED_YR1] or [QRF_UTIL_RATE_YR1]% was utilized.\nFor the second year covered by the audit period, [PPA_IMPLEMENTED_YR2] out of [PPA_BUDGETED_YR2] budgeted programs, projects, and activities were implemented, utilizing [DRRM_UTILIZED_YR2] or [DRRM_UTIL_RATE_YR2]% of the funds available for disaster prevention and mitigation, preparedness and response, and rehabilitation and recovery. Of the Quick Response Fund, [QRF_UTILIZED_YR2] or [QRF_UTIL_RATE_YR2]% was utilized.\nFor the third year covered by the audit period, [PPA_IMPLEMENTED_YR3] out of [PPA_BUDGETED_YR3] budgeted programs, projects, and activities were implemented, utilizing [DRRM_UTILIZED_YR3] or [DRRM_UTIL_RATE_YR3]% of the funds available for disaster prevention and mitigation, preparedness and response, and rehabilitation and recovery. Of the Quick Response Fund, [QRF_UTILIZED_YR3] or [QRF_UTIL_RATE_YR3]% was utilized."
   },
   {
    "type": "effect",
    "text": "The Barangay was able to implement most of the budgeted projects. However, some projects remained unimplemented, resulting in the non-delivery of the corresponding intended benefits to the constituents."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We reiterate our recommendation that Management utilize its 5% LDRRM Fund in accordance with the Philippine Disaster Risk Reduction and Management Act of 2010 so that the expected benefits to the beneficiaries/constituents will be achieved or delivered on time."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-010",
  "title": "Substantial Compliance on Implementation of 20% Barangay Development Fund",
  "area": "20% Development Fund",
  "wp": "WP-DF001",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The Barangay had made substantial accomplishment on programs, projects and activities (PPAs) funded under the 20% Development Fund (DF) during [AUDIT_PERIOD] in accordance with DBM-DOF-DILG Joint Memorandum Circular No. 1 dated November 4, 2020, thus addressing the development needs of the constituents and promoting the general welfare of the people."
   },
   {
    "type": "criteria",
    "lead": "Pertinent provisions of DBM-DOF-DILG Joint Memorandum Circular No. 1 dated November 4, 2020 provides among others that:",
    "text": "3.1 In accordance with Section 287 of RA No. 7160, each LGU shall appropriate in its annual budget no less than twenty percent (20%) of its annual IRA for development projects.\n3.2 The LGUs are enjoined to observe the following policies and guidelines in the appropriation and utilization of the 20% DF:\n3.2.1 The 20% DF shall be utilized to finance the LGUs' priority development projects, as embodied in their respective duly approved local development plans, and medium-term and annual investment programs, which should be harmonized with the Regional Development Plan and the Philippine Development Plan.\n3.2.2 The development projects that may be included under the 20% DF shall be those that are necessary, appropriate, or incidental to efficient and effective local governance, and those which are essential to the promotion of the general welfare of the people.\n3.2.3 The LGUs shall ensure that the development projects to be funded out of the 20% DF are well-planned and procurement-and implementation-ready.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Review of the Barangay Budgets for CY [AUDIT_YEARS] disclosed that the Barangay appropriated funds for various Programs, Projects and Activities (PPAs) under the 20% Development Fund, as summarized below:"
   },
   {
    "type": "table",
    "n": 1
   },
   {
    "type": "paragraph",
    "text": "As shown above, the appropriations complied with Section 287 of R.A. No. 7160, which requires every local government unit to appropriate in its annual budget no less than twenty percent (20%) of its annual National Tax Allotment (NTA) for development projects.\nThe Barangay Development Council (BDC) identified various Programs, Projects and Activities (PPAs) intended to support the socio-economic development and environmental management objectives of the Barangay. Review of the appropriations and corresponding disbursements under the 20% Development Fund disclosed the following utilization during the [AUDIT_YEARS]:"
   },
   {
    "type": "table",
    "n": 2
   },
   {
    "type": "paragraph",
    "text": "As shown above, the utilization rates during the years covered disclosed that significant portion of the 20% Development Fund was utilized, indicating substantial progress in the implementation of the programmed PPAs and the delivery of their intended benefits to the Barangay’s constituents."
   },
   {
    "type": "effect",
    "text": "While full utilization of the Development Fund is still ongoing, the utilization achieved reflects continued implementation of the programmed PPAs and the delivery of intended benefits to the target beneficiaries. Management should continue to closely monitor the completion of the remaining initiatives to ensure the timely achievement of the intended results."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We commend the Barangay for its substantial compliance in the utilization and allocation of the 20% of the Internal Revenue Allotment for development projects. However, we recommend that Management continue to closely monitor the implementation and completion of the remaining programs, projects and activities funded under the 20% Development Fund to maximize fund utilization and ensure the timely delivery of the intended benefits to the Barangay’s constituents."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-011",
  "title": "Partial Compliance on Implementation of 20% Barangay Development Fund",
  "area": "20% Development Fund",
  "wp": "WP-DF001",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The Barangay has partially implemented the programs, projects and activities (PPAs) funded under the 20% Development Fund (DF) during [AUDIT_PERIOD] which is not accordance with DBM-DOF-DILG Joint Memorandum Circular No. 1 dated November 4, 2020,thereby limiting the extent to which the development needs of the constituents were addressed and the general welfare of the people was promoted."
   },
   {
    "type": "criteria",
    "lead": "Pertinent provisions of DBM-DOF-DILG Joint Memorandum Circular No. 1 dated November 4, 2020 provides among others that:",
    "text": "3.1 In accordance with Section 287 of RA No. 7160, each LGU shall appropriate in its annual budget no less than twenty percent (20%) of its annual IRA for development projects.\n3.2 The LGUs are enjoined to observe the following policies and guidelines in the appropriation and utilization of the 20% DF:\n3.2.1 The 20% DF shall be utilized to finance the LGUs' priority development projects, as embodied in their respective duly approved local development plans, and medium-term and annual investment programs, which should be harmonized with the Regional Development Plan and the Philippine Development Plan.\n3.2.2 The development projects that may be included under the 20% DF shall be those that are necessary, appropriate, or incidental to efficient and effective local governance, and those which are essential to the promotion of the general welfare of the people.\n3.2.3 The LGUs shall ensure that the development projects to be funded out of the 20% DF are well-planned and procurement-and implementation-ready.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Review of the Barangay Budgets for CY [AUDIT_YEARS] disclosed that the Barangay appropriated funds for various Programs, Projects and Activities (PPAs) under the 20% Development Fund, as summarized below:"
   },
   {
    "type": "table",
    "n": 1
   },
   {
    "type": "paragraph",
    "text": "As shown above, the appropriations complied with Section 287 of R.A. No. 7160, which requires every local government unit to appropriate in its annual budget no less than twenty percent (20%) of its annual National Tax Allotment (NTA) for development projects.\nThe Barangay Development Council (BDC) identified various Programs, Projects and Activities (PPAs) intended to support the socio-economic development and environmental management objectives of the Barangay. Review of the appropriations and corresponding disbursements under the 20% Development Fund disclosed the following utilization during the [AUDIT_YEARS]:"
   },
   {
    "type": "table",
    "n": 2
   },
   {
    "type": "paragraph",
    "text": "As shown above, the utilization rates during the years covered disclosed that part of the 20% Development Fund remained unutilized, thereby delaying the implementation of programmed PPAs and the timely delivery of their intended benefits to the Barangay’s constituents."
   },
   {
    "type": "effect",
    "text": "While it is commendable that the Barangay appropriated the required budget for the implementation of various PPAs, the constituents were not able to fully realize the intended benefits of the programs because not all projects were implemented as planned. Moreover, delayed implementation would be disadvantageous to the Barangay, as increases in the prices of goods, materials, and services could render the originally programmed budget insufficient at the time of actual implementation."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We commend the Barangay for its substantial compliance in the utilization and allocation of the 20% of the Internal Revenue Allotment for development projects. However, we recommend that Management determine and address the causes of the low utilization of the 20% Development Fund and closely monitor the implementation and completion of the programmed PPAs to maximize fund utilization and ensure the timely delivery of the intended benefits to the Barangay’s constituents."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-012",
  "title": "Non-disclosure of the 5% DRRMF Funds in the Notes to Financial Statements",
  "area": "5% BDRRMF",
  "wp": "WP-DRRM02",
  "section": "A",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "No disclosure of the Local Disaster Risk Reduction and Management Funds (LDRRMF) in the Notes to Financial Statements was made contrary to the provisions of COA Circular No. 2012-002 dated September 12, 2012, thereby resulting in incomplete vital information in the Financial Statements"
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "IPSAS 1 requires that financial statements shall present fairly the financial position, financial performance, and cash flows of an entity. Fair presentation requires the faithful representation of the effects of transactions, other events, and conditions in accordance with the definitions and recognition criteria for assets, liabilities, revenues and expenses set out in IPSASs.\nItem 5.1.16 of COA Circular No. 2012-002 provides that “The amount and details of the unexpended balance of LDRRMF shall be discussed in the Notes to Financial Statements.”",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "Annex D of the same Circular presented the sample disclosure in the Notes to Financial Statements (FS) of the Barangay, to wit:"
   },
   {
    "type": "table",
    "n": 1
   },
   {
    "type": "cause",
    "text": "However, upon examination of the Notes to Financial Statement (FS) of the Barangay, we observed that no disclosure was made regarding its fund utilization and its related unexpended balances as required in the abovementioned circular.\nFurther review of the Barangay’s financial records revealed the non-preparation and the non-submission of the Record of Appropriations and Obligations (RAO), which is essential for tracking the utilization of appropriations. Consequently, the Statement of Appropriations, Obligations, and Balances (SAOB), which is derived from the RAO and is required to be submitted monthly to the Punong Barangay and Sangguniang Barangay by the CCA, was likewise neither prepared nor submitted. The absence of these documents compromises the accuracy and reliability of the Notes to the Financial Statements, rendering any disclosures incomplete and unverifiable."
   },
   {
    "type": "effect",
    "text": "Overall, vital information on LDRRMF was not disclosed in the financial statements. As a result, essential details regarding the Local Disaster Risk Reduction and Management Fund (LDRRMF) were not reflected in the financial statements, thereby indicating that monitoring and reporting of LDRRMF balances were not accurately made."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We recommend that the Municipal Accountant ensure that the utilization of the LDRRM Funds and unexpended balances thereof are fully disclosed in the Notes to Financial Statements in compliance with COA rules and regulations."
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-013",
  "title": "Outstanding Receivable",
  "area": "Receivables",
  "wp": "WP-REC001",
  "section": "A",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "Receivables totaling [TOTAL_RECEIVABLES] remained uncollected for more than two (2) years due to Management’s failure to enforce collection, thereby depriving the BLGU of the timely use of government funds and resources, contrary to Section 2 of P.D. No. 1445. Moreover, the validity, existence, and correctness thereof could not be ascertained due to the absence of subsidiary ledgers."
   },
   {
    "type": "criteria",
    "lead": "Section 112 of P.D. No. 1445 provides that:",
    "text": "Each government agency shall record its financial transactions and operations conformably with generally accepted accounting principles and in accordance with pertinent laws and regulations.",
    "quoted": true
   },
   {
    "type": "criteria",
    "lead": "",
    "text": "Paragraph 27 of IPSAS 1 likewise requires financial statements to present fairly the financial position, financial performance, and cash flows of an entity. Fair presentation requires the faithful presentation of transactions, other events, and conditions in accordance with the applicable recognition and disclosure requirements.\nFurther, Section 4(e) of the Manual on the New Government Accounting System for LGUs requires the maintenance of subsidiary ledgers for receivables and liabilities for each debtor or creditor, showing the relevant reference documents and account balances, and requires that these subsidiary ledgers be reconciled with the corresponding general ledger accounts.",
    "quoted": false
   },
   {
    "type": "condition",
    "text": "Examination of the Financial Statements of the Barangay for the past two fiscal years disclosed that Other Receivables totaling [TOTAL_RECEIVABLES] remained uncollected for more than two (2) years. Moreover, most of the receivables were not supported by subsidiary ledgers containing the detailed information for each debtor; hence, the validity, existence, and correctness of the recorded balances could not be adequately established."
   },
   {
    "type": "cause",
    "text": "The prolonged non-collection was attributable to Management’s failure to effectively enforce the collection and settlement of outstanding receivables. The absence of subsidiary ledgers likewise limited the identification and verification of individual debtors and outstanding balances, thereby hindering the issuance of demand letters and confirmation of accounts."
   },
   {
    "type": "effect",
    "text": "Consequently, government resources remained tied up in uncollected receivables, depriving the Barangay of funds that could otherwise have been used for its programs and operations. Further, the absence of adequate subsidiary records cast doubt on the reliability of the reported receivable balances in the financial statements."
   },
   {
    "type": "recommendation",
    "lead": "We recommend that Management:",
    "items": [
     "Conduct regular and periodic verification, analysis, and validation of the existence of the receivables and determine the concerned debtors to ascertain their collectibility. If proven to be no longer collectible, request for authority to write-off dormant receivable accounts and attach required documents prescribed under COA Circular No. 2016-005; and",
     "Maintain subsidiary ledgers to ensure complete information on the accounts and to facilitate the collection thereof."
    ],
    "text": ""
   }
  ],
  "saor": ""
 },
 {
  "code": "OBS-014",
  "title": "Compliance with the 5% BDRRMF Allocation",
  "area": "5% BDRRMF",
  "wp": "",
  "section": "B",
  "entityTypes": [
   "barangay"
  ],
  "blocks": [
   {
    "type": "topic",
    "text": "The Barangay budgeted the required five percent (5%) for the Barangay Disaster Risk Reduction and Management Fund (BDRRMF) for CYs [AUDIT_YEARS] pursuant to Section 21 of Republic Act No. 10121, thereby ensuring that the minimum funding requirement for disaster risk reduction and management activities was provided in its annual budgets."
   },
   {
    "type": "criteria",
    "lead": "Section 21 of Republic Act No. 10121 provides that:",
    "text": "Not less than five percent (5%) of the estimated revenue from regular sources shall be set aside as the LDRRMF to support disaster risk management activities such as, but not limited to, pre-disaster preparedness programs including training, purchasing life-saving rescue equipment, supplies and medicines, for post-disaster activities, and for the payment of premiums on calamity insurance.\nxxx\nOf the amount appropriated for LDRRMF, thirty percent (30%) shall be allocated as Quick Response Fund (QRF) or stand-by fund for relief and recovery programs in order that situation and living conditions of people in communities or areas struck by disasters, calamities, epidemics, or complex emergencies, may be normalized as quickly as possible.",
    "quoted": true
   },
   {
    "type": "condition",
    "text": "Examination of the approved budgets for CYs [AUDIT_YEARS] disclosed the following allocations for the Barangay Disaster Risk Reduction and Management Fund (BDRRMF), including the corresponding Quick Response Fund (QRF):"
   },
   {
    "type": "table",
    "n": 1
   },
   {
    "type": "paragraph",
    "text": "As shown above, the Barangay complied with the required five percent (5%) BDRRMF allocation and the corresponding thirty percent (30%) allocation for the QRF for CYs [AUDIT_YEARS], thereby ensuring that the minimum funding requirement for disaster risk reduction and management was met and that the prescribed portion for immediate relief and recovery was duly provided in the annual budgets."
   },
   {
    "type": "recommendation",
    "lead": "",
    "items": [],
    "text": "We commend the Barangay for its compliance with the required allocation of the five percent (5%) BDRRMF, including the prescribed allocation for the Quick Response Fund (QRF), thereby ensuring the availability of funds to support disaster risk reduction and management activities and immediate relief and recovery needs during disasters or emergencies. Furthermore, we recommend that the Barangay sustain its compliance with the required five percent (5%) BDRRMF allocation and the corresponding thirty percent (30%) QRF allocation in succeeding annual budgets."
   }
  ],
  "saor": ""
 }
];
