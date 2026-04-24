import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeft: {},
  headerRight: { textAlign: "right" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BLUE },
  companyDetail: { fontSize: 7, color: GRAY },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginVertical: 6,
  },
  docTitle: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginTop: 8,
    marginBottom: 2,
  },
  invoiceNumber: {
    textAlign: "center",
    fontSize: 10,
    color: GRAY,
    marginBottom: 12,
  },
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
  // Line items table
  lineHeader: {
    flexDirection: "row",
    backgroundColor: BLUE,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  lineHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  lineRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  lineDesc: { flex: 1, fontSize: 9 },
  lineAmount: { width: 100, fontSize: 9, textAlign: "right" },
  // Totals
  totalsContainer: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalsTable: {
    width: 220,
    borderWidth: 1,
    borderColor: BORDER,
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsRowLast: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: BLUE,
  },
  totalsLabel: {
    flex: 1,
    fontSize: 9,
    color: GRAY,
  },
  totalsValue: {
    width: 90,
    fontSize: 9,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  totalsLabelBold: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalsValueBold: {
    width: 90,
    fontSize: 10,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  // Payment instructions
  paymentBox: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginTop: 10,
    backgroundColor: LIGHT_GRAY,
  },
  paymentTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 6,
  },
  paymentLine: {
    fontSize: 8,
    color: GRAY,
    marginBottom: 2,
  },
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
})

export interface InvoicePdfData {
  invoiceNumber: string
  invoiceDate: string
  buyerName: string
  buyerEmail: string
  buyerAddress: string | null
  vehicleDescription: string
  subtotalCents: number
  gstCents: number
  totalCents: number
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
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

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
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

        {/* Invoice Title */}
        <Text style={styles.docTitle}>TAX INVOICE</Text>
        <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>

        {/* Invoice Details */}
        <Text style={styles.sectionTitle}>INVOICE DETAILS</Text>
        <View style={styles.table}>
          <TableRow label="Invoice Number" value={data.invoiceNumber} />
          <TableRow label="Invoice Date" value={data.invoiceDate} />
          <TableRow label="ABN" value="69 695 170 453" isLast />
        </View>

        {/* Bill To */}
        <Text style={styles.sectionTitle}>BILL TO</Text>
        <View style={styles.table}>
          <TableRow label="Name" value={data.buyerName} />
          <TableRow label="Email" value={data.buyerEmail} />
          <TableRow label="Address" value={data.buyerAddress || ""} isLast />
        </View>

        {/* Line Items */}
        <Text style={styles.sectionTitle}>ITEMS</Text>
        <View style={styles.table}>
          <View style={styles.lineHeader}>
            <Text style={[styles.lineHeaderText, { flex: 1 }]}>Description</Text>
            <Text style={[styles.lineHeaderText, { width: 100, textAlign: "right" }]}>Amount (AUD)</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineDesc}>{data.vehicleDescription}</Text>
            <Text style={styles.lineAmount}>${formatCurrency(data.subtotalCents)}</Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>${formatCurrency(data.subtotalCents)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST (10%)</Text>
              <Text style={styles.totalsValue}>${formatCurrency(data.gstCents)}</Text>
            </View>
            <View style={styles.totalsRowLast}>
              <Text style={styles.totalsLabelBold}>Total (inc. GST)</Text>
              <Text style={styles.totalsValueBold}>${formatCurrency(data.totalCents)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Instructions */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>Payment Instructions</Text>
          <Text style={styles.paymentLine}>Please make payment via bank transfer to:</Text>
          <Text style={styles.paymentLine}>Account Name: Stateline Holdings Pty Ltd</Text>
          <Text style={styles.paymentLine}>BSB: 033-072</Text>
          <Text style={styles.paymentLine}>Account Number: 538513</Text>
          <Text style={styles.paymentLine}>Bank: Westpac</Text>
          <Text style={styles.paymentLine}>Reference: {data.invoiceNumber}</Text>
          <Text style={[styles.paymentLine, { marginTop: 6 }]}>
            Payment is due within 7 days of invoice date.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Direct Auto — 697 Burke Road, Camberwell VIC 3124 | ABN: 69 695 170 453 | LMCT: 0013130
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoiceDocument data={data} />)
  return Buffer.from(buffer)
}
