import React, { useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { generateQrMatrix, generateQrSvg } from '@/lib/qrcode';

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
  const qrMatrix = useMemo(() => generateQrMatrix(data.orderNumber), [data.orderNumber]);

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 320,
        aspectRatio: 80 / 90,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        padding: 12,
        alignSelf: 'center',
      }}
    >
      {/* Sender Block - Business details at top */}
      <View style={{ marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {data.businessLogo && (
            <Image
              source={{ uri: data.businessLogo }}
              style={{ width: 24, height: 24, marginRight: 6 }}
              resizeMode="contain"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#000000' }} numberOfLines={1}>
              {data.businessName}
            </Text>
            {data.businessPhone ? (
              <Text style={{ fontSize: 8, color: '#555555', marginTop: 1 }}>{data.businessPhone}</Text>
            ) : null}
            {data.businessWebsite ? (
              <Text style={{ fontSize: 7, color: '#777777' }}>{data.businessWebsite}</Text>
            ) : null}
          </View>
        </View>
        {data.returnAddress ? (
          <Text style={{ fontSize: 7, color: '#666666', marginTop: 2 }} numberOfLines={2}>
            {data.returnAddress}
          </Text>
        ) : null}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#D1D5DB', marginBottom: 6 }} />

      {/* Order + QR Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 7, fontWeight: '600', color: '#888888', letterSpacing: 1, textTransform: 'uppercase' }}>
            {primaryOrderLabel}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#000000', letterSpacing: 0.3 }}>
            {primaryOrderNumber}
          </Text>
          {hasWebsiteOrder && (
            <Text style={{ fontSize: 7, fontWeight: '600', color: '#999999', marginTop: 1 }}>
              REF: {data.orderNumber}
            </Text>
          )}
        </View>
        <View style={{ width: 48, height: 48, borderWidth: 1, borderColor: '#D1D5DB', padding: 2, backgroundColor: '#FFFFFF' }}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
          >
            {qrMatrix.map((row, rowIndex) =>
              row.map((filled, colIndex) =>
                filled ? (
                  <Rect
                    key={`${rowIndex}-${colIndex}`}
                    x={colIndex}
                    y={rowIndex}
                    width={1}
                    height={1}
                    fill="#000000"
                  />
                ) : null
              )
            )}
          </Svg>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#D1D5DB', marginBottom: 6 }} />

      {/* Recipient Block */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 7, fontWeight: '600', color: '#888888', letterSpacing: 1, marginBottom: 2, textTransform: 'uppercase' }}>
          SHIP TO
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }} numberOfLines={1}>
          {data.customerName}
        </Text>
        <Text style={{ fontSize: 10, color: '#222222', marginTop: 1 }}>
          {data.customerPhone}
        </Text>
        <Text style={{ fontSize: 9, color: '#444444', marginTop: 3, lineHeight: 13 }} numberOfLines={3}>
          {data.deliveryAddress}
        </Text>
      </View>

      {/* Logistics at bottom - large bold text for thermal printers */}
      {data.logisticsProvider ? (
        <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#D1D5DB' }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#000000', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
            {data.logisticsProvider}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Generate QR Code SVG for the order number
 * Always encodes the FYLL internal order number
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
  const qrSvg = generateQrSvg(data.orderNumber, 60);

  // Determine primary order display
  const hasWebsiteOrder = !!data.websiteOrderRef;
  const primaryOrderLabel = hasWebsiteOrder ? 'ORDER' : 'INTERNAL ORDER';
  const primaryOrderNumber = hasWebsiteOrder ? data.websiteOrderRef! : data.orderNumber;

  // Build sender contact lines
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
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: 80mm 90mm; margin: 0; }
          @media screen {
            html, body { width: 80mm; height: 90mm; margin: 0 auto; padding: 0; background: #f5f5f5; }
            body { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            html, body { width: 80mm !important; height: 90mm !important; margin: 0 !important; padding: 0 !important; background: white !important; overflow: hidden !important; }
            body { padding: 3mm !important; }
            body > *:not(.label) { display: none !important; visibility: hidden !important; }
            .label { display: flex !important; visibility: visible !important; page-break-before: avoid !important; page-break-after: avoid !important; page-break-inside: avoid !important; }
          }
          body { font-family: Arial, Helvetica, sans-serif; width: 80mm; height: 90mm; padding: 3mm; background: white; color: black; }
          .label { width: 100%; height: 100%; display: flex; flex-direction: column; }

          .sender { margin-bottom: 1.5mm; }
          .sender-row { display: flex; align-items: flex-start; }
          .sender-logo { width: 7mm; height: 7mm; margin-right: 2mm; object-fit: contain; }
          .sender-info { flex: 1; }
          .sender-name { font-size: 9pt; font-weight: 800; color: #000; line-height: 1.1; }
          .sender-contact { font-size: 6.5pt; color: #555; line-height: 1.3; }
          .sender-address { font-size: 6pt; color: #666; margin-top: 0.5mm; line-height: 1.2; }

          .divider { height: 0.3mm; background: #CCC; margin: 1.5mm 0; }

          .order-qr-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5mm; }
          .order-info { flex: 1; margin-right: 2mm; }
          .order-label { font-size: 6pt; font-weight: 600; color: #888; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 0.5mm; }
          .order-number { font-size: 15pt; font-weight: 900; color: #000; letter-spacing: 0.3px; line-height: 1; }
          .fyll-ref { font-size: 5.5pt; font-weight: 600; color: #999; margin-top: 0.5mm; }
          .qr-box { width: 16mm; height: 16mm; border: 0.3mm solid #CCC; padding: 1mm; }
          .qr-box svg { width: 100%; height: 100%; }

          .recipient { flex: 1; }
          .ship-to-label { font-size: 6pt; font-weight: 600; color: #888; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 1mm; }
          .recipient-name { font-size: 11pt; font-weight: 700; color: #000; line-height: 1.1; }
          .recipient-phone { font-size: 8.5pt; color: #222; margin-top: 0.5mm; }
          .recipient-address { font-size: 8pt; color: #333; margin-top: 1.5mm; line-height: 1.3; }

          .logistics-footer { margin-top: auto; padding-top: 1.5mm; border-top: 0.3mm solid #CCC; text-align: center; }
          .logistics-text { font-size: 14pt; font-weight: 900; color: #000; letter-spacing: 1px; text-transform: uppercase; }
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
            ${data.returnAddress ? `<div class="sender-address">${escapeHtml(data.returnAddress).replace(/\n/g, ', ')}</div>` : ''}
          </div>

          <div class="divider"></div>

          <!-- Order + QR Row -->
          <div class="order-qr-row">
            <div class="order-info">
              <div class="order-label">${primaryOrderLabel}</div>
              <div class="order-number">${escapeHtml(primaryOrderNumber)}</div>
              ${hasWebsiteOrder ? `<div class="fyll-ref">REF: ${escapeHtml(data.orderNumber)}</div>` : ''}
            </div>
            <div class="qr-box">${qrSvg}</div>
          </div>

          <div class="divider"></div>

          <!-- Recipient Block -->
          <div class="recipient">
            <div class="ship-to-label">SHIP TO</div>
            <div class="recipient-name">${escapeHtml(data.customerName)}</div>
            <div class="recipient-phone">${escapeHtml(data.customerPhone)}</div>
            <div class="recipient-address">${escapeHtml(data.deliveryAddress).replace(/\n/g, '<br>')}</div>
          </div>

          <!-- Logistics at bottom -->
          ${data.logisticsProvider ? `<div class="logistics-footer"><span class="logistics-text">${escapeHtml(data.logisticsProvider)}</span></div>` : ''}
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
