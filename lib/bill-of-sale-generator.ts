import { prisma } from './prisma'

export async function generateBillOfSaleHtml(vehicleId: string): Promise<string> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      identity: true,
    },
  })

  if (!vehicle) throw new Error('Vehicle not found')

  const sellerName = vehicle.identity?.fullLegalName || vehicle.sellerName
  const sellerAddress = vehicle.identity?.address || ''
  const price = vehicle.sellerPrice ? `$${vehicle.sellerPrice.toLocaleString('en-AU')}` : '$_________'

  const styles = `
    <style>
      @page { size: A4; margin: 20mm 25mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; line-height: 1.5; }
      .page { padding: 0; }
      .letterhead { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
      .letterhead h2 { font-size: 18px; color: #1e40af; letter-spacing: 2px; margin-bottom: 2px; }
      .letterhead .subtitle { font-size: 10px; color: #555; letter-spacing: 1px; }
      h1 { text-align: center; font-size: 22px; margin: 24px 0 8px; letter-spacing: 1px; }
      .subheader { text-align: center; font-size: 12px; margin-bottom: 24px; font-style: italic; }
      .party-section { margin-bottom: 16px; }
      .party-section h3 { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
      .party-row { display: flex; margin-bottom: 4px; }
      .party-label { width: 140px; font-weight: bold; flex-shrink: 0; }
      .party-value { flex: 1; border-bottom: 1px dotted #999; min-height: 18px; padding-left: 4px; }
      .terms { margin: 20px 0; }
      .terms p { margin-bottom: 10px; text-align: justify; }
      .terms ol { padding-left: 20px; }
      .terms ol > li { margin-bottom: 10px; text-align: justify; }
      .terms ol > li > ol { list-style-type: lower-alpha; padding-left: 20px; margin-top: 6px; }
      .terms ol > li > ol > li { margin-bottom: 4px; }
      .vehicle-table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; }
      .vehicle-table td { padding: 5px 8px; border: 1px solid #333; font-size: 11px; }
      .vehicle-table td:first-child { font-weight: bold; width: 45%; background: #f5f5f5; }
      .signature-section { margin-top: 32px; }
      .signature-section h3 { font-size: 13px; font-weight: bold; margin-bottom: 16px; }
      .sig-row { display: flex; margin-bottom: 20px; align-items: flex-end; }
      .sig-label { width: 220px; font-size: 11px; flex-shrink: 0; }
      .sig-line { flex: 1; border-bottom: 1px solid #333; min-height: 20px; }
      .schedule { margin-top: 40px; page-break-before: always; }
      .schedule h2 { font-size: 16px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
      .schedule-content { min-height: 500px; border: 1px dashed #ccc; padding: 20px; }
      .schedule-content p { color: #999; font-style: italic; text-align: center; }
      .page-number { text-align: center; font-size: 9px; color: #999; margin-top: 30px; }
      .footer-line { text-align: center; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 20px; }
    </style>
  `

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body>`

  // Page 1
  html += `
    <div class="page">
      <div class="letterhead">
        <h2>DIRECT AUTO WHOLESALE</h2>
        <div class="subtitle">697 Burke Road, Camberwell VIC 3124</div>
      </div>

      <h1>BILL OF SALE</h1>
      <p class="subheader">This Bill of Sale Agreement is made between:</p>

      <div class="party-section">
        <h3>Seller</h3>
        <div class="party-row">
          <span class="party-label">Name:</span>
          <span class="party-value">${escapeHtml(sellerName)}</span>
        </div>
        <div class="party-row">
          <span class="party-label">Address:</span>
          <span class="party-value">${escapeHtml(sellerAddress)}</span>
        </div>
        <div class="party-row">
          <span class="party-label">Customer ID (NT):</span>
          <span class="party-value"></span>
        </div>
        <div class="party-row">
          <span class="party-label">Date of Birth:</span>
          <span class="party-value"></span>
        </div>
      </div>

      <div class="party-section">
        <h3>Buyer</h3>
        <div class="party-row">
          <span class="party-label">Name:</span>
          <span class="party-value">Direct Auto Wholesale</span>
        </div>
        <div class="party-row">
          <span class="party-label">Address:</span>
          <span class="party-value">697 Burke Road, Camberwell</span>
        </div>
      </div>

      <div class="terms">
        <p>This Bill of Sale Agreement sets out the terms of the sale and purchase of the vehicle agreed between the buyer and seller as follows:</p>

        <ol>
          <li>
            Seller hereby sells, and Buyer hereby buys, the following vehicle for AUD ${escapeHtml(price)}

            <table class="vehicle-table">
              <tr><td>Vehicle registration number</td><td>${escapeHtml(vehicle.registrationNumber)}</td></tr>
              <tr><td>VIN</td><td>${escapeHtml(vehicle.vin)}</td></tr>
              <tr><td>Engine No</td><td></td></tr>
              <tr><td>Year</td><td>${vehicle.year}</td></tr>
              <tr><td>Make</td><td>${escapeHtml(vehicle.make)}</td></tr>
              <tr><td>Model</td><td>${escapeHtml(vehicle.model)}</td></tr>
              <tr><td>Model Year</td><td>${vehicle.year}</td></tr>
              <tr><td>Body Shape</td><td></td></tr>
              <tr><td>Colour</td><td></td></tr>
              <tr><td>Transmission</td><td></td></tr>
              <tr><td>Fuel</td><td></td></tr>
              <tr><td>Odometer</td><td>${vehicle.odometer.toLocaleString()} km</td></tr>
              <tr><td>Cyl/Rotors</td><td></td></tr>
              <tr><td>Seats</td><td></td></tr>
              <tr><td>Number of Doors (incl. hatch)</td><td></td></tr>
            </table>
          </li>

          <li>The full description and picture of the vehicle as represented by Seller is set out in the Schedule.</li>

          <li>
            Seller hereby represents and thereby warrants to Buyer:
            <ol>
              <li>there are no legal restrictions preventing Seller from entering into this Bill of Sale Agreement;</li>
              <li>Seller is the sole legal and beneficial owner of the vehicle;</li>
              <li>the vehicle is free of any encumbrances or adverse claims or interests whatsoever (whether legal, equitable or otherwise);</li>
              <li>Seller will provide to Buyer any and all duly executed documents or forms as are required in order to transfer title in the vehicle free of any encumbrances or adverse claims or interests whatsoever.</li>
            </ol>
          </li>

          <li>Seller hereby covenants to indemnify Buyer against any and all claims and demands, including any expenses and costs incurred by Buyer, by any other party in relation to the ownership of the vehicle.</li>

          <li>Purchase price is ${escapeHtml(price)} All inclusive.</li>
        </ol>
      </div>

      <div class="signature-section">
        <h3>Executed by the parties as an agreement on</h3>

        <div class="sig-row">
          <span class="sig-label">Date signed:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">Signature of Representative:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">Name of Signatory:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">Position within Company:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">In the presence of (Witness):</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">Print name:</span>
          <span class="sig-line"></span>
        </div>

        <div style="margin-top: 24px;"></div>

        <div class="sig-row">
          <span class="sig-label">Signature of Buyer:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">In the presence of (Witness):</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-row">
          <span class="sig-label">Print name:</span>
          <span class="sig-line"></span>
        </div>
      </div>

      <div class="footer-line">Page 1 of 2 &mdash; Direct Auto Wholesale &mdash; Bill of Sale</div>
    </div>

    <div class="schedule">
      <h2>SCHEDULE</h2>
      <div class="schedule-content">
        <p>Vehicle photographs and additional description to be attached.</p>
      </div>
      <div class="footer-line">Page 2 of 2 &mdash; Direct Auto Wholesale &mdash; Bill of Sale</div>
    </div>
  `

  html += '</body></html>'
  return html
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
