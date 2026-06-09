import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.4 },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e40af', paddingBottom: 8 },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#1e40af' },
  subtitle: { fontSize: 8, color: '#666', marginTop: 2 },
  title: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginVertical: 12, color: '#1e40af' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', backgroundColor: '#f0f4ff', padding: 4, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '40%', fontWeight: 'bold', color: '#333' },
  value: { width: '60%', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingBottom: 1 },
  term: { marginBottom: 6 },
  termNumber: { fontWeight: 'bold' },
  signatureBox: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, minHeight: 50 },
  signedBanner: { backgroundColor: '#059669', padding: 8, marginBottom: 12, textAlign: 'center' },
  signedBannerText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' },
})

interface InspectionAuthData {
  // Vehicle
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  colour?: string
  // Owner
  ownerName: string
  vehicleLocation?: string
  // Signing
  isSigned?: boolean
  signerName?: string
  signedAt?: string
  signerIp?: string
}

function InspectionAuthorisationDocument({ data }: { data: InspectionAuthData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>DIRECT AUTO</Text>
          <Text style={styles.subtitle}>
            Stateline Holdings Pty Ltd t/a Direct Auto | ABN 69 695 170 453 | LMCT 0013130
          </Text>
        </View>

        {/* Signed Banner */}
        {data.isSigned && (
          <View style={styles.signedBanner}>
            <Text style={styles.signedBannerText}>
              AUTHORISATION SIGNED — {data.signerName} — {data.signedAt}
            </Text>
          </View>
        )}

        <Text style={styles.title}>PRE-PURCHASE INSPECTION AUTHORISATION</Text>

        {/* Section 1: Client Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. CLIENT (SELLER / OWNER) DETAILS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Full Name of Owner / Authorised Representative</Text>
            <Text style={styles.value}>{data.ownerName}</Text>
          </View>
        </View>

        {/* Section 2: Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. VEHICLE DETAILS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>VIN (Vehicle Identification Number)</Text>
            <Text style={styles.value}>{data.vin}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Registration Plate</Text>
            <Text style={styles.value}>{data.registrationNumber}</Text>
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
            <Text style={styles.label}>Year of Manufacture</Text>
            <Text style={styles.value}>{String(data.year)}</Text>
          </View>
          {data.colour && (
            <View style={styles.row}>
              <Text style={styles.label}>Colour</Text>
              <Text style={styles.value}>{data.colour}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Location for Inspection</Text>
            <Text style={styles.value}>{data.vehicleLocation || ''}</Text>
          </View>
        </View>

        {/* Section 3: Authorisation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. AUTHORISATION</Text>
          <Text>
            I, the undersigned, confirm that I am the legal owner or authorised representative of the above-mentioned vehicle.
          </Text>
          <Text style={{ marginTop: 4 }}>
            I hereby grant permission to Direct Auto (Stateline Holdings Pty Ltd t/a Direct Auto, LMCT 0013130, ABN 69 695 170 453) or its nominated inspection representative to carry out a pre-purchase inspection of the vehicle listed above at a mutually agreed time and location.
          </Text>
          <Text style={{ marginTop: 4 }}>
            The inspection may include mechanical, structural, electrical, and visual assessments as reasonably required by the Buyer.
          </Text>
        </View>

        {/* Section 4: Terms & Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. TERMS & CONDITIONS</Text>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>1. Scope of Inspection. </Text>I authorise Direct Auto or its nominated inspector to conduct a full pre-purchase inspection of the vehicle described above. The inspection may include mechanical, structural, electrical, and visual assessments, as well as a test drive where reasonably required.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>2. PPSR Search. </Text>I acknowledge that Direct Auto may conduct a Personal Property Securities Register (PPSR) search on the vehicle as part of its due diligence process. This search is conducted at Direct Auto&apos;s cost and does not impose any encumbrance on the vehicle.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>3. PPSR Security Interest on Deposit. </Text>I acknowledge that if Direct Auto proceeds to purchase the vehicle and makes a deposit payment to me, a PPSR security interest will be registered by Direct Auto over the vehicle immediately upon payment of that deposit, in accordance with the Personal Property Securities Act 2009 (Cth). This registration will remain in place until full settlement is completed and the vehicle is collected. By signing this form, I consent to such registration being lodged if a deposit is made.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>4. Inspection Cost. </Text>The cost of the inspection is borne by Direct Auto. If either the buyer or seller withdraws from the transaction after the inspection has been booked or commenced, the party withdrawing agrees to cover the full cost of the inspection, including any transport or third-party inspection fees.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>5. Inspection Report. </Text>I understand that the inspection report is an independent assessment only and does not guarantee the future condition, performance, or value of the vehicle. Direct Auto reserves the right to withdraw from any proposed transaction based on the inspection findings.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>6. Vehicle Condition. </Text>I confirm that the vehicle will be made available for inspection in its current condition and will not be materially altered between the time of this authorisation and the inspection. I agree to disclose any known defects or issues to Direct Auto prior to or at the time of inspection.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>7. Access and Availability. </Text>I agree to make the vehicle available at the agreed time and location. If I need to reschedule, I will provide at least 24 hours&apos; notice to Direct Auto. I acknowledge that failure to provide reasonable access may result in inspection costs being charged to me.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>8. No Obligation to Purchase. </Text>This authorisation does not constitute an offer or commitment by Direct Auto to purchase the vehicle. Direct Auto&apos;s obligation to purchase will only arise upon execution of a formal Vehicle Purchase Agreement.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>9. Privacy. </Text>I consent to Direct Auto collecting and using my personal information provided on this form for the purpose of conducting the inspection, evaluating the vehicle, and processing any subsequent vehicle purchase, in accordance with Direct Auto&apos;s Privacy and Data Protection Policy.</Text>
          </View>

          <View style={styles.term}>
            <Text><Text style={styles.termNumber}>10. Governing Law. </Text>This form is governed by the laws of Victoria, Australia.</Text>
          </View>
        </View>

        {/* Section 5: Signature */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. SIGNATURE & ACKNOWLEDGEMENT</Text>
          <Text style={{ marginBottom: 6 }}>
            I have read and understood the terms and conditions above. All information provided is true and correct to the best of my knowledge. I consent to the pre-purchase inspection of the vehicle described on this form.
          </Text>

          <View style={styles.signatureBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Signature</Text>
              <Text style={styles.value}>{data.isSigned ? data.signerName : ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Full Name (print)</Text>
              <Text style={styles.value}>{data.isSigned ? data.signerName : ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{data.isSigned ? data.signedAt : ''}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Form prepared by Direct Auto (Stateline Holdings Pty Ltd t/a Direct Auto) | Retain completed original for records.
          {data.isSigned && data.signerIp ? ` | Signed from IP: ${data.signerIp}` : ''}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateInspectionAuthorisationPdf(data: InspectionAuthData): Promise<Buffer> {
  return renderToBuffer(<InspectionAuthorisationDocument data={data} />)
}
