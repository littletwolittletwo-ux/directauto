import nodemailer from 'nodemailer'

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    // Return a preview-only transporter for development
    return null
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function emailHeader(dealershipName: string) {
  return `
    <div style="background: #1e40af; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${dealershipName}</h1>
    </div>
  `
}

function emailFooter(contactEmail?: string) {
  return `
    <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 8px 8px;">
      ${contactEmail ? `<p>Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ''}
      <p>This is an automated message. Please do not reply directly.</p>
    </div>
  `
}

export async function sendSellerConfirmation({
  to,
  sellerName,
  confirmationNumber,
  vin,
  make,
  model,
  year,
  dealershipName,
  contactEmail,
}: {
  to: string
  sellerName: string
  confirmationNumber: string
  vin: string
  make: string
  model: string
  year: number
  dealershipName: string
  contactEmail?: string
}) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[MAILER] Seller confirmation email (SMTP not configured):', { to, confirmationNumber })
    return
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Submission Confirmed — Ref #${confirmationNumber} | ${dealershipName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1e293b;">Thank you, ${sellerName}</h2>
          <p style="color: #475569;">We've received your vehicle submission and will review your documents shortly.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Reference</td>
              <td style="padding: 8px 0; font-weight: 600;">${confirmationNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">VIN</td>
              <td style="padding: 8px 0;">${vin}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Vehicle</td>
              <td style="padding: 8px 0;">${year} ${make} ${model}</td>
            </tr>
          </table>
          <p style="color: #475569;">We'll review your documents and be in touch within 24 hours.</p>
        </div>
        ${emailFooter(contactEmail)}
      </div>
    `,
  })
}

export async function sendAdminNewSubmission({
  to,
  confirmationNumber,
  sellerName,
  make,
  model,
  vehicleId,
  dealershipName,
}: {
  to: string
  confirmationNumber: string
  sellerName: string
  make: string
  model: string
  vehicleId: string
  dealershipName: string
}) {
  const transporter = getTransporter()
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  if (!transporter) {
    console.log('[MAILER] Admin new submission email (SMTP not configured):', { to, confirmationNumber })
    return
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `New Submission — ${make} ${model} from ${sellerName} — Ref #${confirmationNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1e293b;">New Vehicle Submission</h2>
          <p><strong>Seller:</strong> ${sellerName}</p>
          <p><strong>Vehicle:</strong> ${make} ${model}</p>
          <p><strong>Reference:</strong> ${confirmationNumber}</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${baseUrl}/admin/vehicles/${vehicleId}" style="background: #1e40af; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Review Now →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
  })
}

export async function sendPPSRFlagAlert({
  to,
  vin,
  flags,
  vehicleId,
  dealershipName,
}: {
  to: string
  vin: string
  flags: string[]
  vehicleId: string
  dealershipName: string
}) {
  const transporter = getTransporter()
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  if (!transporter) {
    console.log('[MAILER] PPSR flag alert (SMTP not configured):', { to, vin, flags })
    return
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `⚠️ PPSR Flag — ${vin} requires urgent review`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #dc2626;">⚠️ PPSR Flag Detected</h2>
          <p>VIN: <strong>${vin}</strong></p>
          <ul>${flags.map(f => `<li style="color: #dc2626;">${f}</li>`).join('')}</ul>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${baseUrl}/admin/vehicles/${vehicleId}" style="background: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Review Now →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
  })
}

export async function sendSaleAgreementEmail({
  to,
  buyerName,
  year,
  make,
  model,
  salePrice,
  dealershipName,
  contactEmail,
  pdfBuffer,
  pdfFilename,
}: {
  to: string
  buyerName: string
  year: number
  make: string
  model: string
  salePrice: number
  dealershipName: string
  contactEmail?: string
  pdfBuffer: Buffer
  pdfFilename: string
}) {
  const transporter = getTransporter()

  if (!transporter) {
    console.log('[MAILER] Sale agreement email (SMTP not configured):', { to, pdfFilename })
    return
  }

  const formattedPrice = salePrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Vehicle Sale Agreement — ${year} ${make} ${model} | ${dealershipName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1e293b;">Sale Agreement</h2>
          <p>Hi ${buyerName},</p>
          <p style="color: #475569;">Please find attached the sale agreement for the <strong>${year} ${make} ${model}</strong> at a price of <strong>AUD $${formattedPrice}</strong>.</p>
          <p style="color: #475569;">Please review the agreement, sign it, and return it to us at your earliest convenience.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Vehicle</td>
              <td style="padding: 8px 0; font-weight: 600;">${year} ${make} ${model}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Sale Price</td>
              <td style="padding: 8px 0; font-weight: 600;">AUD $${formattedPrice}</td>
            </tr>
          </table>
          <p style="color: #475569;">If you have any questions, please don't hesitate to contact us.</p>
        </div>
        ${emailFooter(contactEmail)}
      </div>
    `,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

export async function sendApprovalConfirmation({
  to,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vin,
  purchasePrice,
  approvedBy,
  dealershipName,
  csvContent,
}: {
  to: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: number
  vin: string
  purchasePrice: number
  approvedBy: string
  dealershipName: string
  csvContent?: string | null
}) {
  const transporter = getTransporter()

  if (!transporter) {
    console.log('[MAILER] Approval confirmation (SMTP not configured):', { to, vin })
    return
  }

  const formattedPrice = purchasePrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })

  const attachments = csvContent
    ? [
        {
          filename: `easycars-import-${vin}.csv`,
          content: csvContent,
          contentType: 'text/csv',
        },
      ]
    : []

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Vehicle Approved & Paid — ${vehicleYear} ${vehicleMake} ${vehicleModel} | ${dealershipName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #16a34a;">Vehicle Approved & Payment Authorized</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Vehicle</td>
              <td style="padding: 8px 0; font-weight: 600;">${vehicleYear} ${vehicleMake} ${vehicleModel}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">VIN</td>
              <td style="padding: 8px 0;">${vin}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Purchase Price</td>
              <td style="padding: 8px 0; font-weight: 600;">AUD $${formattedPrice}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Approved By</td>
              <td style="padding: 8px 0;">${approvedBy}</td>
            </tr>
          </table>
          ${csvContent ? '<p style="color: #475569;">EasyCars CSV import file is attached.</p>' : '<p style="color: #475569;">Vehicle has been synced to EasyCars via API.</p>'}
        </div>
        ${emailFooter()}
      </div>
    `,
    attachments,
  })
}

export async function sendBillOfSaleEmail({
  to,
  sellerName,
  year,
  make,
  model,
  purchasePrice,
  signingLink,
  dealershipName,
  contactEmail,
}: {
  to: string
  sellerName: string
  year: number
  make: string
  model: string
  purchasePrice: number
  signingLink: string
  dealershipName: string
  contactEmail?: string
}) {
  const transporter = getTransporter()

  if (!transporter) {
    console.log('[MAILER] Bill of Sale email (SMTP not configured):', { to, signingLink })
    return
  }

  const formattedPrice = purchasePrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Bill of Sale — ${year} ${make} ${model} | ${dealershipName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1e293b;">Bill of Sale</h2>
          <p>Hi ${sellerName},</p>
          <p style="color: #475569;">Please review and sign the Bill of Sale for the <strong>${year} ${make} ${model}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Vehicle</td>
              <td style="padding: 8px 0; font-weight: 600;">${year} ${make} ${model}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Purchase Price</td>
              <td style="padding: 8px 0; font-weight: 600;">AUD $${formattedPrice}</td>
            </tr>
          </table>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${signingLink}" style="background: #1e40af; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Review & Sign Document</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This link will expire in 7 days. If you have any questions, please contact us.</p>
        </div>
        ${emailFooter(contactEmail)}
      </div>
    `,
  })
}

export async function sendBillOfSaleConfirmation({
  to,
  sellerName,
  year,
  make,
  model,
  purchasePrice,
  dealershipName,
  contactEmail,
  pdfBuffer,
  pdfFilename,
}: {
  to: string
  sellerName: string
  year: number
  make: string
  model: string
  purchasePrice: number
  dealershipName: string
  contactEmail?: string
  pdfBuffer: Buffer
  pdfFilename: string
}) {
  const transporter = getTransporter()

  if (!transporter) {
    console.log('[MAILER] Bill of Sale confirmation (SMTP not configured):', { to, pdfFilename })
    return
  }

  const formattedPrice = purchasePrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Bill of Sale Signed — ${year} ${make} ${model} | ${dealershipName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #16a34a;">Bill of Sale — Signed Successfully</h2>
          <p>Hi ${sellerName},</p>
          <p style="color: #475569;">Thank you for signing the Bill of Sale for the <strong>${year} ${make} ${model}</strong>. A copy of the signed document is attached for your records.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Vehicle</td>
              <td style="padding: 8px 0; font-weight: 600;">${year} ${make} ${model}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Purchase Price</td>
              <td style="padding: 8px 0; font-weight: 600;">AUD $${formattedPrice}</td>
            </tr>
          </table>
          <p style="color: #475569;">The Direct Auto team will be in touch to arrange payment and vehicle handover.</p>
        </div>
        ${emailFooter(contactEmail)}
      </div>
    `,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

export async function sendSellerMoreInfoRequest({
  to,
  sellerName,
  confirmationNumber,
  message,
  dealershipName,
  contactEmail,
}: {
  to: string
  sellerName: string
  confirmationNumber: string
  message: string
  dealershipName: string
  contactEmail?: string
}) {
  const transporter = getTransporter()

  if (!transporter) {
    console.log('[MAILER] More info request (SMTP not configured):', { to, confirmationNumber, message })
    return
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Action Required — Additional Information Needed | Ref #${confirmationNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        ${emailHeader(dealershipName)}
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1e293b;">Additional Information Needed</h2>
          <p>Hi ${sellerName},</p>
          <p>Regarding your submission <strong>Ref #${confirmationNumber}</strong>, we need the following:</p>
          <div style="background: #f8fafc; border-left: 4px solid #1e40af; padding: 16px; margin: 16px 0;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <p>Please respond at your earliest convenience.</p>
        </div>
        ${emailFooter(contactEmail)}
      </div>
    `,
  })
}
