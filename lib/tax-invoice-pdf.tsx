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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {},
  headerRight: { textAlign: "right" },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginBottom: 2,
  },
  companyDetail: { fontSize: 9, color: "#475569" },
  invoiceTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 2,
  },
  invoiceMeta: { fontSize: 9, color: "#475569" },
  hr: {
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
    marginVertical: 12,
  },
  hrLight: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  billBlock: { width: "48%" },
  billLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  billValue: { fontSize: 10, marginBottom: 1 },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e40af",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tableHeaderCell: {
    padding: 8,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableCell: { padding: 8, fontSize: 9 },
  colDesc: { width: "55%" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "17.5%", textAlign: "right" },
  colTotal: { width: "17.5%", textAlign: "right" },
  totalsContainer: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "35%",
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 10, color: "#475569", flex: 1 },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "35%",
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: "#1e40af",
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    flex: 1,
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    textAlign: "right",
  },
  note: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  noteTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 4,
  },
  noteText: { fontSize: 8, color: "#64748b", lineHeight: 1.6 },
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

interface TaxInvoiceData {
  invoiceNumber: string
  invoiceDate: string
  // Seller (the company selling the vehicle)
  sellerCompanyName: string
  sellerAbn: string
  sellerName: string
  sellerAddress: string
  // Buyer (Direct Auto)
  buyerName: string
  buyerAddress: string
  buyerAbn: string
  // Vehicle
  vehicleDescription: string
  vin: string
  registrationNumber: string
  // Amounts
  salePrice: number
  gstAmount: number
  totalIncGst: number
  // Reference
  confirmationNumber: string
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatAbn(abn: string): string {
  const digits = abn.replace(/\D/g, "")
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`
  }
  return abn
}

function TaxInvoiceDocument({ data }: { data: TaxInvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{data.sellerCompanyName}</Text>
            <Text style={styles.companyDetail}>ABN: {formatAbn(data.sellerAbn)}</Text>
            {data.sellerAddress ? (
              <Text style={styles.companyDetail}>{data.sellerAddress}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceMeta}>Invoice No: {data.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Date: {data.invoiceDate}</Text>
          </View>
        </View>

        <View style={styles.hr} />

        {/* Bill From / Bill To */}
        <View style={styles.row}>
          <View style={styles.billBlock}>
            <Text style={styles.billLabel}>From</Text>
            <Text style={styles.billValue}>{data.sellerCompanyName}</Text>
            <Text style={styles.billValue}>ABN: {formatAbn(data.sellerAbn)}</Text>
            <Text style={styles.billValue}>{data.sellerName}</Text>
            {data.sellerAddress ? (
              <Text style={styles.billValue}>{data.sellerAddress}</Text>
            ) : null}
          </View>
          <View style={styles.billBlock}>
            <Text style={styles.billLabel}>Bill To</Text>
            <Text style={styles.billValue}>{data.buyerName}</Text>
            <Text style={styles.billValue}>ABN: {data.buyerAbn}</Text>
            <Text style={styles.billValue}>{data.buyerAddress}</Text>
          </View>
        </View>

        <View style={styles.hrLight} />

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.colDesc]}>
              <Text>{data.vehicleDescription}</Text>
              <Text style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>
                VIN: {data.vin}  |  Rego: {data.registrationNumber}
              </Text>
            </View>
            <Text style={[styles.tableCell, styles.colQty]}>1</Text>
            <Text style={[styles.tableCell, styles.colPrice]}>
              ${formatCurrency(data.salePrice)}
            </Text>
            <Text style={[styles.tableCell, styles.colTotal]}>
              ${formatCurrency(data.salePrice)}
            </Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${formatCurrency(data.salePrice)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (10%)</Text>
            <Text style={styles.totalValue}>${formatCurrency(data.gstAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total (inc. GST)</Text>
            <Text style={styles.grandTotalValue}>${formatCurrency(data.totalIncGst)}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Notes</Text>
          <Text style={styles.noteText}>
            This tax invoice is issued in relation to the sale of the above motor vehicle.
          </Text>
          <Text style={styles.noteText}>
            Reference: {data.confirmationNumber}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {data.sellerCompanyName} | ABN: {formatAbn(data.sellerAbn)} | Invoice: {data.invoiceNumber}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateTaxInvoicePdf(
  vehicleId: string
): Promise<Buffer> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      identity: true,
      saleAgreement: true,
    },
  })

  if (!vehicle) throw new Error("Vehicle not found")
  if (!vehicle.saleAgreement) throw new Error("No sale agreement found")
  if (!vehicle.isCompanyVehicle) throw new Error("Not a company sale")

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  })

  const salePrice = vehicle.saleAgreement.salePrice
  const gstAmount = Math.round((salePrice / 11) * 100) / 100
  const now = new Date()

  const data: TaxInvoiceData = {
    invoiceNumber: `INV-${vehicle.confirmationNumber}`,
    invoiceDate: now.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    sellerCompanyName: vehicle.companyName || "",
    sellerAbn: vehicle.companyAbn || "",
    sellerName:
      vehicle.identity?.fullLegalName || vehicle.sellerName,
    sellerAddress: vehicle.identity?.address || "",
    buyerName: settings?.dealershipName || "Direct Auto Wholesale",
    buyerAddress: "697 Burke Road, Camberwell VIC 3124",
    buyerAbn: settings?.abn || "",
    vehicleDescription: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vin: vehicle.vin,
    registrationNumber: vehicle.registrationNumber,
    salePrice,
    gstAmount,
    totalIncGst: salePrice,
    confirmationNumber: vehicle.confirmationNumber,
  }

  const buffer = await renderToBuffer(
    <TaxInvoiceDocument data={data} />
  )
  return Buffer.from(buffer)
}
