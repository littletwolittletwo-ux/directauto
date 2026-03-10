import { prisma } from './prisma'

export async function generateVehiclePDFHtml(vehicleId: string, full = true): Promise<string> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      identity: true,
      ownership: true,
      ppsrCheck: true,
      documents: true,
      auditLogs: { orderBy: { createdAt: 'asc' }, include: { user: true } },
    },
  })

  if (!vehicle) throw new Error('Vehicle not found')

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const dealershipName = settings?.dealershipName || 'Direct Auto Wholesale'
  const riskFlags = (vehicle.riskFlags as string[]) || []
  const dateGenerated = new Date().toLocaleDateString('en-AU', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; }
      .page { page-break-after: always; padding: 40px; }
      .page:last-child { page-break-after: avoid; }
      .header { background: #1e40af; color: white; padding: 32px; text-align: center; margin-bottom: 24px; border-radius: 4px; }
      .header h1 { font-size: 20px; margin-bottom: 4px; }
      .header .ref { font-size: 14px; opacity: 0.9; }
      h2 { font-size: 14px; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; margin: 20px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      td, th { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 11px; }
      th { background: #f1f5f9; font-weight: 600; width: 35%; }
      .flag-red { color: #dc2626; font-weight: 600; }
      .flag-green { color: #16a34a; font-weight: 600; }
      .signature { font-family: 'Brush Script MT', cursive; font-size: 24px; color: #1e293b; }
      .footer { text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 24px; }
      .risk-gauge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; color: white; }
      .risk-low { background: #16a34a; }
      .risk-med { background: #d97706; }
      .risk-high { background: #dc2626; }
    </style>
  `

  const footer = `<div class="footer">CONFIDENTIAL — ${dealershipName} — Generated ${dateGenerated} — Ref #${vehicle.confirmationNumber}</div>`

  const riskClass = vehicle.riskScore <= 20 ? 'risk-low' : vehicle.riskScore <= 50 ? 'risk-med' : 'risk-high'
  const riskLabel = vehicle.riskScore <= 20 ? 'Low' : vehicle.riskScore <= 50 ? 'Medium' : 'High'

  let html = `<!DOCTYPE html><html><head>${styles}</head><body>`

  // Cover page
  html += `
    <div class="page">
      <div class="header">
        <h1>${dealershipName}</h1>
        <p style="font-size: 16px; margin-top: 12px;">Vehicle Acquisition Report</p>
        <p class="ref">${vehicle.confirmationNumber}</p>
        <p style="font-size: 11px; margin-top: 8px;">Generated: ${dateGenerated}</p>
      </div>
      <h2>Vehicle Details</h2>
      <table>
        <tr><th>VIN</th><td>${vehicle.vin}</td></tr>
        <tr><th>Registration</th><td>${vehicle.registrationNumber}</td></tr>
        <tr><th>Make</th><td>${vehicle.make}</td></tr>
        <tr><th>Model</th><td>${vehicle.model}</td></tr>
        <tr><th>Year</th><td>${vehicle.year}</td></tr>
        <tr><th>Odometer</th><td>${vehicle.odometer.toLocaleString()} km</td></tr>
        ${vehicle.sellerPrice ? `<tr><th>Price</th><td>$${vehicle.sellerPrice.toLocaleString()}</td></tr>` : ''}
        ${vehicle.location ? `<tr><th>Location</th><td>${vehicle.location}</td></tr>` : ''}
        <tr><th>Status</th><td>${vehicle.status.replace(/_/g, ' ')}</td></tr>
        <tr><th>Submitted</th><td>${vehicle.submittedAt.toLocaleDateString('en-AU')}</td></tr>
      </table>
      ${footer}
    </div>
  `

  // Seller Identity
  html += `
    <div class="page">
      <h2>Seller Identity</h2>
      <table>
        <tr><th>Name (vehicle)</th><td>${vehicle.sellerName}</td></tr>
        <tr><th>Phone</th><td>${vehicle.sellerPhone}</td></tr>
        <tr><th>Email</th><td>${vehicle.sellerEmail}</td></tr>
        ${vehicle.identity ? `
          <tr><th>Legal Name (licence)</th><td>${vehicle.identity.fullLegalName}</td></tr>
          <tr><th>Address</th><td>${vehicle.identity.address}</td></tr>
          <tr><th>Licence Number</th><td>${vehicle.identity.driversLicenceNumber}</td></tr>
          <tr><th>Licence State</th><td>${vehicle.identity.licenceState}</td></tr>
          <tr><th>Licence Expiry</th><td>${vehicle.identity.licenceExpiry.toLocaleDateString('en-AU')}</td></tr>
        ` : '<tr><td colspan="2">No identity information provided</td></tr>'}
      </table>

      <h2>Ownership</h2>
      <table>
        ${vehicle.ownership ? `
          <tr><th>Document Type</th><td>${vehicle.ownership.documentType}</td></tr>
          ${vehicle.ownership.notes ? `<tr><th>Notes</th><td>${vehicle.ownership.notes}</td></tr>` : ''}
        ` : '<tr><td colspan="2">No ownership record</td></tr>'}
      </table>
      ${footer}
    </div>
  `

  if (full) {
    // PPSR
    html += `
      <div class="page">
        <h2>PPSR Results</h2>
        <table>
          ${vehicle.ppsrCheck ? `
            <tr><th>Checked At</th><td>${vehicle.ppsrCheck.checkedAt.toLocaleDateString('en-AU')}</td></tr>
            <tr><th>Written Off</th><td class="${vehicle.ppsrCheck.isWrittenOff ? 'flag-red' : 'flag-green'}">${vehicle.ppsrCheck.isWrittenOff ? 'YES' : 'No'}</td></tr>
            <tr><th>Stolen</th><td class="${vehicle.ppsrCheck.isStolen ? 'flag-red' : 'flag-green'}">${vehicle.ppsrCheck.isStolen ? 'YES' : 'No'}</td></tr>
            <tr><th>Finance Owing</th><td class="${vehicle.ppsrCheck.hasFinance ? 'flag-red' : 'flag-green'}">${vehicle.ppsrCheck.hasFinance ? 'YES' : 'No'}</td></tr>
            <tr><th>Status</th><td>${vehicle.ppsrCheck.status}</td></tr>
          ` : '<tr><td colspan="2">PPSR check not yet performed</td></tr>'}
        </table>

        <h2>Risk Assessment</h2>
        <p style="margin-bottom: 8px;">Score: <span class="risk-gauge ${riskClass}">${vehicle.riskScore} — ${riskLabel}</span></p>
        ${riskFlags.length > 0 ? `
          <table>
            <tr><th>Flag</th></tr>
            ${riskFlags.map(f => `<tr><td class="flag-red">${f}</td></tr>`).join('')}
          </table>
        ` : '<p>No risk flags detected.</p>'}
        ${footer}
      </div>
    `

    // Declaration
    html += `
      <div class="page">
        <h2>Declaration</h2>
        <div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
          <p>I, ${vehicle.sellerName}, declare that I am the legal owner of the above vehicle, all information provided is true and correct to the best of my knowledge, and I have full legal right to sell this vehicle. I consent to my identity being verified by the dealership.</p>
        </div>
        ${vehicle.sellerSignature ? `
          <table>
            <tr><th>Signature</th><td><span class="signature">${vehicle.sellerSignature}</span></td></tr>
            <tr><th>Signed At</th><td>${vehicle.signedAt?.toLocaleString('en-AU') || 'N/A'}</td></tr>
            <tr><th>IP Address</th><td>${vehicle.ipAddress || 'N/A'}</td></tr>
          </table>
        ` : '<p>No signature recorded.</p>'}

        <h2>Audit Trail</h2>
        <table>
          <tr style="background: #f1f5f9;"><th style="width: 25%;">Timestamp</th><th style="width: 20%;">User</th><th style="width: 25%;">Action</th><th style="width: 30%;">Details</th></tr>
          ${vehicle.auditLogs.map(log => `
            <tr>
              <td>${log.createdAt.toLocaleString('en-AU')}</td>
              <td>${log.user?.name || 'System'}</td>
              <td>${log.action}</td>
              <td>${log.details ? JSON.stringify(log.details) : ''}</td>
            </tr>
          `).join('')}
        </table>
        ${footer}
      </div>
    `
  } else {
    // Seller summary: declaration only
    html += `
      <div class="page">
        <h2>Declaration</h2>
        <div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <p>I, ${vehicle.sellerName}, declare that I am the legal owner of the above vehicle, all information provided is true and correct to the best of my knowledge, and I have full legal right to sell this vehicle.</p>
        </div>
        ${vehicle.sellerSignature ? `<p style="margin-top: 12px;"><span class="signature">${vehicle.sellerSignature}</span></p>` : ''}
        ${footer}
      </div>
    `
  }

  html += '</body></html>'
  return html
}
