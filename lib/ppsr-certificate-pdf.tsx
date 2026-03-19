/**
 * PPSR Certificate PDF generator
 * Uses @react-pdf/renderer to generate a certificate from PPSR check results
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
  },
  header: {
    textAlign: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: {
    width: 180,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  resultRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 4,
  },
  resultClear: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  resultFlag: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  resultLabel: {
    width: 180,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  resultValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  clearText: {
    color: '#16a34a',
  },
  flagText: {
    color: '#dc2626',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
  summaryBanner: {
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryBannerClear: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  summaryBannerWarning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  summaryBannerDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
})

interface PPSRCertificateData {
  vin: string
  make: string
  model: string
  year: number
  registrationNumber: string
  searchDate: string
  searchTime: string
  referenceNumber: string
  isWrittenOff: boolean
  isStolen: boolean
  hasFinance: boolean
}

function ResultRow({ label, flagged }: { label: string; flagged: boolean }) {
  return (
    <View style={[styles.resultRow, flagged ? styles.resultFlag : styles.resultClear]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, flagged ? styles.flagText : styles.clearText]}>
        {flagged ? 'YES — FLAGGED' : 'Clear'}
      </Text>
    </View>
  )
}

function PPSRCertificateDocument({ data }: { data: PPSRCertificateData }) {
  const hasAnyFlag = data.isWrittenOff || data.isStolen || data.hasFinance
  const isDangerous = data.isWrittenOff || data.isStolen

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>PPSR Search Certificate</Text>
          <Text style={styles.subtitle}>Personal Property Securities Register</Text>
        </View>

        {/* Summary Banner */}
        <View style={[
          styles.summaryBanner,
          isDangerous ? styles.summaryBannerDanger
            : hasAnyFlag ? styles.summaryBannerWarning
            : styles.summaryBannerClear,
        ]}>
          <Text style={styles.summaryText}>
            {isDangerous
              ? (data.isStolen ? 'STOLEN VEHICLE RECORD FOUND' : 'WRITTEN OFF VEHICLE RECORD FOUND')
              : hasAnyFlag
              ? 'FINANCE / ENCUMBRANCE FOUND'
              : 'NO ADVERSE RECORDS FOUND'}
          </Text>
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>VIN</Text>
            <Text style={styles.value}>{data.vin}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Make</Text>
            <Text style={styles.value}>{data.make}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Model</Text>
            <Text style={styles.value}>{data.model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Year</Text>
            <Text style={styles.value}>{String(data.year)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Registration</Text>
            <Text style={styles.value}>{data.registrationNumber || 'N/A'}</Text>
          </View>
        </View>

        {/* Search Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Search Date</Text>
            <Text style={styles.value}>{data.searchDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Search Time</Text>
            <Text style={styles.value}>{data.searchTime}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reference Number</Text>
            <Text style={styles.value}>{data.referenceNumber}</Text>
          </View>
        </View>

        {/* PPSR Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PPSR Results</Text>
          <ResultRow label="Written Off Register" flagged={data.isWrittenOff} />
          <ResultRow label="Stolen Vehicle Register" flagged={data.isStolen} />
          <ResultRow label="Finance / Encumbrance (PPSR)" flagged={data.hasFinance} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Searched by Direct Auto Wholesale | Generated {data.searchDate} {data.searchTime}
          </Text>
          <Text style={styles.footerText}>
            Ref: {data.referenceNumber} | This certificate is for internal use only
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generatePPSRCertificatePDF(data: PPSRCertificateData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <PPSRCertificateDocument data={data} />
  )
  return Buffer.from(buffer)
}
