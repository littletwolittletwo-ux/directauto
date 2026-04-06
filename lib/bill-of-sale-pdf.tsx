import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { renderToBuffer } from "@react-pdf/renderer"

const BLUE = "#1e40af"
const DARK = "#1e293b"
const GRAY = "#475569"
const LIGHT_GRAY = "#f1f5f9"
const BORDER = "#cbd5e1"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK,
    lineHeight: 1.4,
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeft: {},
  headerLogo: { width: 120, height: 40 },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BLUE },
  companyDetail: { fontSize: 7, color: GRAY },
  headerRight: { textAlign: "right" },
  docTitle: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginTop: 8,
    marginBottom: 2,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 9,
    color: GRAY,
    marginBottom: 12,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginVertical: 6,
  },
  // Section headers
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    backgroundColor: BLUE,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  // Table styles
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableLabel: {
    width: "40%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: LIGHT_GRAY,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
  },
  tableValue: {
    width: "60%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  // Two-column table
  twoColTable: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  twoColHalf: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
  },
  // Terms
  termsList: {
    paddingLeft: 8,
    marginBottom: 6,
  },
  termItem: {
    flexDirection: "row",
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 1.5,
  },
  termNumber: {
    width: 16,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
  },
  termText: {
    flex: 1,
  },
  // Condition box
  conditionBox: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    minHeight: 40,
    marginBottom: 6,
  },
  // Signature section
  sigSection: {
    marginTop: 8,
  },
  sigRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 6,
  },
  sigBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
  },
  sigBlockTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
  },
  sigField: {
    flexDirection: "row",
    marginBottom: 4,
  },
  sigLabel: {
    width: "35%",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
  },
  sigValue: {
    flex: 1,
    fontSize: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    minHeight: 14,
    paddingBottom: 1,
  },
  sigValueSigned: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Helvetica-Oblique",
    color: DARK,
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    minHeight: 14,
    paddingBottom: 1,
  },
  signatureImage: {
    height: 40,
    objectFit: "contain",
  },
  // Signed banner
  signedBanner: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
    padding: 10,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  signedBannerText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  signedBannerDate: {
    fontSize: 8,
    marginTop: 2,
    color: "#dcfce7",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
  // Audit trail
  auditNote: {
    fontSize: 6,
    color: "#94a3b8",
    marginTop: 4,
  },
})

export interface BillOfSalePdfData {
  // Seller
  sellerFullName: string
  sellerAddress: string | null
  sellerSuburb: string | null
  sellerState: string | null
  sellerPostcode: string | null
  sellerCustomerId: string | null
  sellerDob: string | null
  sellerPhone: string
  sellerEmail: string
  sellerLicenceNumber: string | null
  // Vehicle
  registrationNumber: string
  stateOfRegistration: string | null
  vinNumber: string
  engineNumber: string | null
  yearOfManufacture: number
  vehicleMake: string
  vehicleModel: string
  vehicleVariant: string | null
  bodyType: string | null
  colour: string | null
  fuelType: string | null
  transmission: string | null
  odometerReading: number
  numberOfKeys: string | null
  // Sale
  purchasePrice: number
  depositPaid: number
  balanceDue: number
  paymentMethod: string | null
  dateOfSale: string
  // Condition
  knownDefects: string | null
  // Signing
  isSigned: boolean
  signerName: string | null
  signedAt: string | null
  signerIp: string | null
  signatureData: string | null
  // Meta
  confirmationNumber: string
  generatedDate: string
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function TableRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={isLast ? styles.tableRowLast : styles.tableRow}>
      <Text style={styles.tableLabel}>{label}</Text>
      <Text style={styles.tableValue}>{value || "—"}</Text>
    </View>
  )
}

function BillOfSaleDocument({ data }: { data: BillOfSalePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Stateline Holdings Pty Ltd</Text>
            <Text style={styles.companyDetail}>TA Direct Auto</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.companyDetail}>ABN: 69 695 170 453 | LMCT: 0013130</Text>
            <Text style={styles.companyDetail}>697 Burke Road, Camberwell VIC 3124</Text>
          </View>
        </View>

        <View style={styles.hr} />

        {/* Title */}
        <Text style={styles.docTitle}>VEHICLE BILL OF SALE</Text>
        <Text style={styles.subtitle}>
          This Bill of Sale Agreement is made between the parties identified below.
        </Text>

        {/* Seller Details */}
        <Text style={styles.sectionTitle}>SELLER DETAILS</Text>
        <View style={styles.table}>
          <TableRow label="Full Legal Name" value={data.sellerFullName} />
          <TableRow label="Address" value={data.sellerAddress || ""} />
          <TableRow label="Suburb / City" value={data.sellerSuburb || ""} />
          <TableRow label="State / Territory" value={data.sellerState || ""} />
          <TableRow label="Postcode" value={data.sellerPostcode || ""} />
          <TableRow label="Customer ID (NT)" value={data.sellerCustomerId || ""} />
          <TableRow label="Date of Birth" value={data.sellerDob || ""} />
          <TableRow label="Phone Number" value={data.sellerPhone} />
          <TableRow label="Email Address" value={data.sellerEmail} />
          <TableRow label="Licence Number" value={data.sellerLicenceNumber || ""} isLast />
        </View>

        {/* Buyer Details */}
        <Text style={styles.sectionTitle}>BUYER DETAILS</Text>
        <View style={styles.table}>
          <TableRow label="Business Name" value="Stateline Holdings Pty Ltd TA Direct Auto" />
          <TableRow label="ABN" value="69 695 170 453" />
          <TableRow label="LMCT" value="0013130" />
          <TableRow label="Address" value="697 Burke Road, Camberwell VIC 3124" />
          <TableRow label="Contact Person" value="Vikram McGinty" />
          <TableRow label="Position" value="Lead Sales" isLast />
        </View>

        {/* Vehicle Details */}
        <Text style={styles.sectionTitle}>VEHICLE DETAILS</Text>
        <View style={styles.table}>
          <TableRow label="Registration Number" value={data.registrationNumber} />
          <TableRow label="State of Registration" value={data.stateOfRegistration || ""} />
          <TableRow label="VIN" value={data.vinNumber} />
          <TableRow label="Engine Number" value={data.engineNumber || ""} />
          <TableRow label="Year of Manufacture" value={String(data.yearOfManufacture)} />
          <TableRow label="Make" value={data.vehicleMake} />
          <TableRow label="Model" value={data.vehicleModel} />
          <TableRow label="Variant / Series" value={data.vehicleVariant || ""} />
          <TableRow label="Body Type" value={data.bodyType || ""} />
          <TableRow label="Colour" value={data.colour || ""} />
          <TableRow label="Fuel Type" value={data.fuelType || ""} />
          <TableRow label="Transmission" value={data.transmission || ""} />
          <TableRow label="Odometer Reading (km)" value={data.odometerReading.toLocaleString()} />
          <TableRow label="Number of Keys Provided" value={data.numberOfKeys || ""} isLast />
        </View>

        {/* Sale Details */}
        <Text style={styles.sectionTitle}>SALE DETAILS</Text>
        <View style={styles.table}>
          <TableRow label="Purchase Price (AUD)" value={`$${formatCurrency(data.purchasePrice)}`} />
          <TableRow label="Deposit Paid (if any)" value={`$${formatCurrency(data.depositPaid)}`} />
          <TableRow label="Balance Due" value={`$${formatCurrency(data.balanceDue)}`} />
          <TableRow label="Payment Method" value={data.paymentMethod || ""} />
          <TableRow label="Date of Sale" value={data.dateOfSale} isLast />
        </View>

        {/* Footer on page 1 */}
        <View style={styles.footer}>
          <Text>
            Direct Auto — 697 Burke Road, Camberwell VIC 3124 | ABN: 69 695 170 453 | LMCT: 0013130
          </Text>
        </View>
      </Page>

      {/* Page 2: Conditions, Terms, Signatures */}
      <Page size="A4" style={styles.page}>
        {/* Header repeat */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Stateline Holdings Pty Ltd</Text>
            <Text style={styles.companyDetail}>TA Direct Auto</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.companyDetail}>Ref: {data.confirmationNumber}</Text>
          </View>
        </View>
        <View style={styles.hr} />

        {/* Vehicle Condition & Disclosures */}
        <Text style={styles.sectionTitle}>VEHICLE CONDITION & DISCLOSURES</Text>
        <Text style={{ fontSize: 8, color: GRAY, marginBottom: 4 }}>
          The full description and picture of the vehicle as represented by the Seller is set out in the
          Schedule (if attached). The Seller discloses the following known defects or conditions:
        </Text>
        <View style={styles.conditionBox}>
          <Text style={{ fontSize: 8 }}>{data.knownDefects || "Nil disclosed"}</Text>
        </View>

        {/* Terms and Conditions */}
        <Text style={styles.sectionTitle}>TERMS AND CONDITIONS</Text>
        <Text style={{ fontSize: 8, color: GRAY, marginBottom: 4 }}>
          The Seller hereby represents and warrants to the Buyer the following:
        </Text>
        <View style={styles.termsList}>
          {[
            "There are no legal restrictions preventing the Seller from entering into this Bill of Sale Agreement.",
            "The Seller is the sole legal and beneficial owner of the vehicle.",
            "The vehicle is free of any encumbrances (or the Buyer has been made aware of any encumbrances) or adverse claims or interests whatsoever, whether legal, equitable or otherwise.",
            "The Seller will provide to the Buyer any and all duly executed documents or forms as are required in order to transfer title in the vehicle free of any encumbrances or adverse claims or interests whatsoever.",
            "The Seller hereby covenants to indemnify the Buyer against any and all claims and demands, including any expenses and costs incurred by the Buyer, by any other party in relation to the ownership of the vehicle.",
            "Title to the vehicle does not pass to the Buyer until cleared funds have been received into the Buyer's nominated bank account.",
            "The purchase price stated above is the full and final amount, all inclusive.",
            "The Seller confirms that all information provided in this Bill of Sale is true and correct to the best of their knowledge.",
            "This agreement is governed by the laws of the State of Victoria, Australia.",
          ].map((term, i) => (
            <View key={i} style={styles.termItem}>
              <Text style={styles.termNumber}>{i + 1}.</Text>
              <Text style={styles.termText}>{term}</Text>
            </View>
          ))}
        </View>

        {/* Signed banner */}
        {data.isSigned && (
          <View style={styles.signedBanner}>
            <Text style={styles.signedBannerText}>DOCUMENT SIGNED</Text>
            <Text style={styles.signedBannerDate}>
              Electronically signed by seller on {data.signedAt}
            </Text>
          </View>
        )}

        {/* EXECUTION */}
        <Text style={styles.sectionTitle}>EXECUTION</Text>
        <Text style={{ fontSize: 8, color: GRAY, marginBottom: 6 }}>
          Executed by the parties as an agreement.
        </Text>

        <View style={styles.sigRow}>
          {/* Buyer / Dealer Representative */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigBlockTitle}>BUYER / DEALER REPRESENTATIVE</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Name:</Text>
              <Text style={styles.sigValue}>Vikram McGinty</Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Position:</Text>
              <Text style={styles.sigValue}>Lead Sales</Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Signature:</Text>
              <Text style={styles.sigValueSigned}>V. McGinty</Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Date:</Text>
              <Text style={styles.sigValue}>{data.dateOfSale}</Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Witness:</Text>
              <Text style={styles.sigValue}></Text>
            </View>
          </View>

          {/* Seller */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigBlockTitle}>SELLER</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Name:</Text>
              <Text style={data.isSigned ? styles.sigValue : styles.sigValue}>
                {data.signerName || ""}
              </Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Signature:</Text>
              {data.isSigned && data.signatureData ? (
                <Image src={data.signatureData} style={styles.signatureImage} />
              ) : data.isSigned && data.signerName ? (
                <Text style={styles.sigValueSigned}>{data.signerName}</Text>
              ) : (
                <Text style={styles.sigValue}></Text>
              )}
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Date:</Text>
              <Text style={styles.sigValue}>{data.isSigned ? data.signedAt : ""}</Text>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Witness:</Text>
              <Text style={styles.sigValue}></Text>
            </View>
          </View>
        </View>

        {/* Digital audit trail */}
        {data.isSigned && (
          <Text style={styles.auditNote}>
            Digital signature recorded from IP: {data.signerIp || "unknown"} on {data.signedAt}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Direct Auto — 697 Burke Road, Camberwell VIC 3124 | ABN: 69 695 170 453 | LMCT: 0013130 | Ref: {data.confirmationNumber}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateBillOfSalePdf(
  data: BillOfSalePdfData
): Promise<Buffer> {
  const buffer = await renderToBuffer(<BillOfSaleDocument data={data} />)
  return Buffer.from(buffer)
}
