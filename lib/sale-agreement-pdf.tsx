import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { renderToBuffer } from "@react-pdf/renderer"
import { prisma } from "./prisma"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
    lineHeight: 1.5,
  },
  header: {
    backgroundColor: "#1e40af",
    color: "#ffffff",
    padding: 20,
    textAlign: "center",
    borderRadius: 4,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  headerAddress: { fontSize: 8, marginTop: 4, color: "#dbeafe" },
  headerEmail: { fontSize: 8, color: "#dbeafe" },
  docTitle: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginTop: 12,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    fontSize: 9,
    color: "#475569",
    marginBottom: 16,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
    paddingBottom: 3,
    marginTop: 14,
    marginBottom: 8,
  },
  partyBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  partyLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 2,
  },
  partyValue: { fontSize: 10, marginBottom: 1 },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableRow: { flexDirection: "row" },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  tableCell: { flex: 1, padding: 6, fontSize: 9 },
  termNumber: {
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  termText: { marginBottom: 6, fontSize: 10, lineHeight: 1.6 },
  ppsrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  sigBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 8,
  },
  sigItem: {
    width: "45%",
    marginBottom: 20,
  },
  sigLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 2,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    height: 24,
    marginBottom: 2,
  },
  sigDateLabel: { fontSize: 7, color: "#94a3b8" },
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
    paddingTop: 6,
  },
})

interface SaleAgreementData {
  dealershipName: string
  sellerName: string
  sellerAddress: string
  sellerLicence: string
  sellerLicenceState: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string | null
  buyerAddress: string | null
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  odometer: number
  colour: string
  salePrice: number
  agreementDate: string
  confirmationNumber: string
  ppsrCheckedAt: string | null
  ppsrResult: string
  generatedDate: string
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function SaleAgreementDocument({ data }: { data: SaleAgreementData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{data.dealershipName}</Text>
          <Text style={styles.headerAddress}>
            697 Burke Road, Camberwell
          </Text>
          <Text style={styles.headerEmail}>contact@directauto.info</Text>
        </View>

        {/* Document Title */}
        <View style={styles.hr} />
        <Text style={styles.docTitle}>VEHICLE SALE AGREEMENT</Text>
        <View style={styles.metaRow}>
          <Text>Date: {data.agreementDate}</Text>
          <Text>Reference: {data.confirmationNumber}</Text>
        </View>

        {/* Parties */}
        <Text style={styles.sectionTitle}>PARTIES</Text>
        <View style={styles.partyBlock}>
          <Text style={styles.partyLabel}>SELLER:</Text>
          <Text style={styles.partyValue}>Name: {data.sellerName}</Text>
          <Text style={styles.partyValue}>
            Address: {data.sellerAddress || "—"}
          </Text>
          <Text style={styles.partyValue}>
            Licence: {data.sellerLicence || "—"}{" "}
            {data.sellerLicenceState ? `(${data.sellerLicenceState})` : ""}
          </Text>
        </View>
        <View style={styles.partyBlock}>
          <Text style={styles.partyLabel}>BUYER:</Text>
          <Text style={styles.partyValue}>Name: {data.buyerName}</Text>
          <Text style={styles.partyValue}>Email: {data.buyerEmail}</Text>
          <Text style={styles.partyValue}>
            Phone: {data.buyerPhone || "—"}
          </Text>
          <Text style={styles.partyValue}>
            Address: {data.buyerAddress || "—"}
          </Text>
        </View>

        {/* Vehicle Details */}
        <Text style={styles.sectionTitle}>VEHICLE DETAILS</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderCell}>VIN</Text>
            <Text style={styles.tableHeaderCell}>Registration</Text>
            <Text style={styles.tableHeaderCell}>Make</Text>
            <Text style={styles.tableHeaderCell}>Model</Text>
            <Text style={styles.tableHeaderCell}>Year</Text>
            <Text style={styles.tableHeaderCell}>Odometer</Text>
            <Text style={styles.tableHeaderCell}>Colour</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>{data.vin}</Text>
            <Text style={styles.tableCell}>{data.registrationNumber}</Text>
            <Text style={styles.tableCell}>{data.make}</Text>
            <Text style={styles.tableCell}>{data.model}</Text>
            <Text style={styles.tableCell}>{data.year}</Text>
            <Text style={styles.tableCell}>
              {data.odometer.toLocaleString()} km
            </Text>
            <Text style={styles.tableCell}>{data.colour || "—"}</Text>
          </View>
        </View>

        {/* Sale Terms */}
        <Text style={styles.sectionTitle}>SALE TERMS</Text>
        <Text style={styles.termText}>
          <Text style={styles.termNumber}>1. </Text>
          The Seller agrees to sell and the Buyer agrees to purchase the above
          vehicle for AUD ${formatCurrency(data.salePrice)}.
        </Text>
        <Text style={styles.termText}>
          <Text style={styles.termNumber}>2. </Text>
          The Seller warrants they are the legal owner, the vehicle is free of
          encumbrances, and the odometer reading is accurate to the best of
          their knowledge.
        </Text>
        <Text style={styles.termText}>
          <Text style={styles.termNumber}>3. </Text>
          The Buyer acknowledges the vehicle is sold as inspected and payment
          is required in full prior to vehicle release.
        </Text>
        <Text style={styles.termText}>
          <Text style={styles.termNumber}>4. </Text>
          Direct Auto Wholesale acts as facilitator only and is not a party to
          this sale.
        </Text>
        <Text style={styles.termText}>
          <Text style={styles.termNumber}>5. </Text>
          This agreement is governed by the laws of Victoria, Australia.
        </Text>

        {/* PPSR Section */}
        <Text style={styles.sectionTitle}>PPSR CHECK</Text>
        <View style={styles.ppsrRow}>
          <Text>
            PPSR Search: {data.ppsrCheckedAt || "Pending"}
          </Text>
          <Text>Result: {data.ppsrResult}</Text>
        </View>

        {/* Signatures */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>
        <View style={styles.sigBlock}>
          <View style={styles.sigItem}>
            <Text style={styles.sigLabel}>Seller</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigDateLabel}>Date: _____________</Text>
          </View>
          <View style={styles.sigItem}>
            <Text style={styles.sigLabel}>Buyer</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigDateLabel}>Date: _____________</Text>
          </View>
          <View style={styles.sigItem}>
            <Text style={styles.sigLabel}>Witness</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigDateLabel}>Date: _____________</Text>
          </View>
          <View style={styles.sigItem}>
            <Text style={styles.sigLabel}>Direct Auto Representative</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigDateLabel}>Date: _____________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {data.dealershipName} | Ref: {data.confirmationNumber} | Generated:{" "}
            {data.generatedDate}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateSaleAgreementPdf(
  vehicleId: string
): Promise<Buffer> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      identity: true,
      ppsrCheck: true,
      saleAgreement: true,
    },
  })

  if (!vehicle) throw new Error("Vehicle not found")
  if (!vehicle.saleAgreement) throw new Error("No sale agreement found")

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  })

  const ppsrFlags: string[] = []
  if (vehicle.ppsrCheck) {
    if (vehicle.ppsrCheck.isWrittenOff) ppsrFlags.push("WRITTEN OFF")
    if (vehicle.ppsrCheck.isStolen) ppsrFlags.push("STOLEN")
    if (vehicle.ppsrCheck.hasFinance) ppsrFlags.push("FINANCE RECORDED")
    if (ppsrFlags.length === 0) ppsrFlags.push("CLEAR")
  }

  const now = new Date()

  const data: SaleAgreementData = {
    dealershipName:
      settings?.dealershipName || "Direct Auto Wholesale",
    sellerName:
      vehicle.identity?.fullLegalName || vehicle.sellerName,
    sellerAddress: vehicle.identity?.address || "",
    sellerLicence: vehicle.identity?.driversLicenceNumber || "",
    sellerLicenceState: vehicle.identity?.licenceState || "",
    buyerName: vehicle.saleAgreement.buyerName,
    buyerEmail: vehicle.saleAgreement.buyerEmail,
    buyerPhone: vehicle.saleAgreement.buyerPhone,
    buyerAddress: vehicle.saleAgreement.buyerAddress,
    vin: vehicle.vin,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    odometer: vehicle.odometer,
    colour: "",
    salePrice: vehicle.saleAgreement.salePrice,
    agreementDate: vehicle.saleAgreement.agreementDate.toLocaleDateString(
      "en-AU",
      { day: "numeric", month: "long", year: "numeric" }
    ),
    confirmationNumber: vehicle.confirmationNumber,
    ppsrCheckedAt: vehicle.ppsrCheck
      ? vehicle.ppsrCheck.checkedAt.toLocaleDateString("en-AU")
      : null,
    ppsrResult: vehicle.ppsrCheck ? ppsrFlags.join(" / ") : "Not checked",
    generatedDate: now.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }

  const buffer = await renderToBuffer(
    <SaleAgreementDocument data={data} />
  )
  return Buffer.from(buffer)
}
