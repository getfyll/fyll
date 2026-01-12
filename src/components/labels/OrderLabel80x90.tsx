import React from 'react';
import { View, Text, Image } from 'react-native';

export interface OrderLabelData {
  // Business/Sender Info
  businessName: string;
  businessLogo: string | null;
  businessPhone: string;
  businessWebsite: string;
  returnAddress: string;
  // Order Info
  orderNumber: string; // Internal FYLL order number
  websiteOrderRef?: string; // Customer-facing order number (WooCommerce)
  // Customer/Recipient Info
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  // Logistics
  logisticsProvider?: string;
}

interface OrderLabel80x90Props {
  data: OrderLabelData;
}

/**
 * Preview component for 80x90mm shipping label
 * Used for visual preview in the app
 *
 * Order Number Hierarchy:
 * - If websiteOrderRef exists: Show it as primary (ORDER #56844), FYLL ref as secondary
 * - If no websiteOrderRef: Show FYLL order number as primary with "INTERNAL ORDER" label
 */
export function OrderLabel80x90Preview({ data }: OrderLabel80x90Props) {
  const hasWebsiteOrder = !!data.websiteOrderRef;
  const primaryOrderLabel = hasWebsiteOrder ? 'ORDER' : 'INTERNAL ORDER';
  const primaryOrderNumber = hasWebsiteOrder ? data.websiteOrderRef! : data.orderNumber;

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 320,
        aspectRatio: 80 / 90,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CCCCCC',
        padding: 12,
        alignSelf: 'center',
      }}
    >
      {/* Sender Block */}
      <View style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {data.businessLogo && (
            <Image
              source={{ uri: data.businessLogo }}
              style={{ width: 28, height: 28, marginRight: 8 }}
              resizeMode="contain"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#000000' }} numberOfLines={1}>
              {data.businessName}
            </Text>
            {data.businessPhone ? (
              <Text style={{ fontSize: 9, color: '#333333', marginTop: 1 }}>{data.businessPhone}</Text>
            ) : null}
            {data.businessWebsite ? (
              <Text style={{ fontSize: 9, color: '#333333' }}>{data.businessWebsite}</Text>
            ) : null}
          </View>
        </View>
        {data.returnAddress ? (
          <Text style={{ fontSize: 8, color: '#444444', marginTop: 2 }} numberOfLines={2}>
            {data.returnAddress}
          </Text>
        ) : null}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#CCCCCC', marginBottom: 8 }} />

      {/* Order Block - Primary Order Number */}
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 8, fontWeight: '600', color: '#666666', letterSpacing: 1 }}>
          {primaryOrderLabel}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#000000', letterSpacing: 0.5 }}>
          {primaryOrderNumber}
        </Text>
      </View>

      {/* Recipient Block */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }} numberOfLines={1}>
          {data.customerName}
        </Text>
        <Text style={{ fontSize: 11, color: '#222222', marginTop: 1 }}>
          {data.customerPhone}
        </Text>
        <Text style={{ fontSize: 10, color: '#333333', marginTop: 3, lineHeight: 14 }} numberOfLines={3}>
          {data.deliveryAddress}
        </Text>
      </View>

      {/* Footer - Logistics & Barcode Group */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
        {data.logisticsProvider ? (
          <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 3 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#333333' }}>
              {data.logisticsProvider}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {/* Barcode Group Container - FYLL Ref + QR as one unit */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 40, alignItems: 'center' }}>
            {hasWebsiteOrder && (
              <Text style={{ fontSize: 5, fontWeight: '700', color: '#666666', marginBottom: 1, textAlign: 'center' }}>
                FYLL REF: {data.orderNumber}
              </Text>
            )}
            <View style={{ width: 40, height: 40, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCCCCC' }}>
              <View style={{ flex: 1, padding: 2 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                  <View key={row} style={{ flexDirection: 'row', flex: 1 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                      <View
                        key={col}
                        style={{
                          flex: 1,
                          backgroundColor: (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2) || ((row + col) % 3 === 0) ? '#000000' : '#FFFFFF',
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Generate QR Code SVG for the order number
 * Always encodes the FYLL internal order number
 */
function generateSimpleQRSVG(data: string, size: number = 60): string {
  const hash = data.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);

  const modules = 21;
  const moduleSize = size / modules;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const isTopLeftFinder = row < 7 && col < 7;
      const isTopRightFinder = row < 7 && col >= modules - 7;
      const isBottomLeftFinder = row >= modules - 7 && col < 7;

      let isFilled = false;

      if (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
        const localRow = row < 7 ? row : row - (modules - 7);
        const localCol = col < 7 ? col : col - (modules - 7);
        isFilled = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6 ||
                   (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4);
      } else {
        const bitIndex = (row * modules + col) % 32;
        isFilled = ((hash >> bitIndex) & 1) === 1 || ((row + col) % 3 === 0 && (hash + row * col) % 5 !== 0);
      }

      if (isFilled) {
        svg += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Generate HTML for printing 80x90mm shipping label
 * Clean courier-style shipping label layout
 *
 * Order Number Hierarchy:
 * - If websiteOrderRef exists: Show it as primary (ORDER #56844), FYLL ref above QR
 * - If no websiteOrderRef: Show FYLL order number as primary with "INTERNAL ORDER" label
 * - QR code always encodes FYLL internal order number
 */
export function generateOrderLabelHTML(data: OrderLabelData): string {
  // QR always encodes the internal FYLL order number
  const qrSvg = generateSimpleQRSVG(data.orderNumber, 60);

  // Determine primary order display
  const hasWebsiteOrder = !!data.websiteOrderRef;
  const primaryOrderLabel = hasWebsiteOrder ? 'ORDER' : 'INTERNAL ORDER';
  const primaryOrderNumber = hasWebsiteOrder ? data.websiteOrderRef! : data.orderNumber;

  // Build sender info lines
  const senderLines: string[] = [];
  if (data.businessPhone) senderLines.push(escapeHtml(data.businessPhone));
  if (data.businessWebsite) senderLines.push(escapeHtml(data.businessWebsite));

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shipping Label - ${escapeHtml(data.orderNumber)}</title>
        <style>
          /* Reset and base styles */
          *, *::before, *::after {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          /* Print-specific page settings for 80x90mm label */
          @page {
            size: 80mm 90mm;
            margin: 0;
          }

          /* Screen preview styles */
          @media screen {
            html, body {
              width: 80mm;
              height: 90mm;
              margin: 0 auto;
              padding: 0;
              background: #f5f5f5;
            }
            body {
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
          }

          /* Print styles - ensure only label prints */
          @media print {
            html, body {
              width: 80mm !important;
              height: 90mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            /* Hide everything else that might be in the page */
            body > *:not(.label) {
              display: none !important;
            }
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            width: 80mm;
            height: 90mm;
            padding: 3mm;
            background: white;
            color: black;
          }
          .label {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          /* Sender Block */
          .sender {
            margin-bottom: 2mm;
          }
          .sender-row {
            display: flex;
            align-items: flex-start;
          }
          .sender-logo {
            width: 8mm;
            height: 8mm;
            margin-right: 2mm;
            object-fit: contain;
          }
          .sender-info {
            flex: 1;
          }
          .sender-name {
            font-size: 10pt;
            font-weight: 800;
            color: #000;
            line-height: 1.1;
          }
          .sender-contact {
            font-size: 7pt;
            color: #333;
            line-height: 1.3;
          }
          .sender-address {
            font-size: 6.5pt;
            color: #444;
            margin-top: 1mm;
            line-height: 1.2;
          }

          /* Divider */
          .divider {
            height: 0.3mm;
            background: #999;
            margin: 2mm 0;
          }

          /* Order Block */
          .order {
            margin-bottom: 2mm;
          }
          .order-label {
            font-size: 7pt;
            font-weight: 600;
            color: #666;
            letter-spacing: 0.5px;
            margin-bottom: 0.5mm;
          }
          .order-number {
            font-size: 16pt;
            font-weight: 900;
            color: #000;
            letter-spacing: 0.3px;
            line-height: 1;
          }

          /* Recipient Block */
          .recipient {
            flex: 1;
          }
          .recipient-name {
            font-size: 11pt;
            font-weight: 700;
            color: #000;
            line-height: 1.1;
          }
          .recipient-phone {
            font-size: 9pt;
            color: #222;
            margin-top: 0.5mm;
          }
          .recipient-address {
            font-size: 8pt;
            color: #333;
            margin-top: 1.5mm;
            line-height: 1.3;
          }

          /* Footer */
          .footer {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-top: auto;
          }
          .logistics {
            background: #F0F0F0;
            padding: 1mm 2mm;
            font-size: 7pt;
            font-weight: 700;
            color: #333;
          }
          .qr-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 15mm;
          }
          .fyll-ref {
            font-size: 5pt;
            font-weight: 700;
            color: #666;
            margin-bottom: 0.5mm;
            text-align: center;
            width: 100%;
          }
          .qr {
            width: 15mm;
            height: 15mm;
          }
          .qr svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <!-- Sender Block -->
          <div class="sender">
            <div class="sender-row">
              ${data.businessLogo ? `<img src="${data.businessLogo}" class="sender-logo" onerror="this.style.display='none'" />` : ''}
              <div class="sender-info">
                <div class="sender-name">${escapeHtml(data.businessName)}</div>
                ${senderLines.length > 0 ? `<div class="sender-contact">${senderLines.join(' | ')}</div>` : ''}
              </div>
            </div>
            ${data.returnAddress ? `<div class="sender-address">${escapeHtml(data.returnAddress).replace(/\n/g, '<br>')}</div>` : ''}
          </div>

          <div class="divider"></div>

          <!-- Order Block -->
          <div class="order">
            <div class="order-label">${primaryOrderLabel}</div>
            <div class="order-number">${escapeHtml(primaryOrderNumber)}</div>
          </div>

          <!-- Recipient Block -->
          <div class="recipient">
            <div class="recipient-name">${escapeHtml(data.customerName)}</div>
            <div class="recipient-phone">${escapeHtml(data.customerPhone)}</div>
            <div class="recipient-address">${escapeHtml(data.deliveryAddress).replace(/\n/g, '<br>')}</div>
          </div>

          <!-- Footer -->
          <div class="footer">
            ${data.logisticsProvider ? `<div class="logistics">${escapeHtml(data.logisticsProvider)}</div>` : '<div></div>'}
            <div class="qr-section">
              ${hasWebsiteOrder ? `<div class="fyll-ref">FYLL REF: ${escapeHtml(data.orderNumber)}</div>` : ''}
              <div class="qr">${qrSvg}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
