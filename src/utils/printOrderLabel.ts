import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { generateOrderLabelHTML, OrderLabelData } from '@/components/labels/OrderLabel80x90';

export interface ShippingLabelSize {
  widthMm: number;
  heightMm: number;
}

export const SHIPPING_LABEL_SIZE_PRESETS: {
  id: string;
  label: string;
  size: ShippingLabelSize;
}[] = [
  { id: '4x6', label: '4x6 in (100x150mm)', size: { widthMm: 100, heightMm: 150 } },
  { id: '80x90', label: '80x90mm', size: { widthMm: 80, heightMm: 90 } },
];

/**
 * Print shipping label for an order using the selected label size.
 * Opens the device's native print dialog
 */
export async function printOrderLabel(
  data: OrderLabelData,
  labelSize: ShippingLabelSize = { widthMm: 80, heightMm: 90 },
): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const html = generateOrderLabelHTML(data, labelSize);
    const mmToPoints = (mm: number) => Math.round(mm * 2.83465);

    // Print the label using expo-print
    // The html content ensures only the label is printed, not the app UI
    await Print.printAsync({
      html,
      width: mmToPoints(labelSize.widthMm),
      height: mmToPoints(labelSize.heightMm),
    });

    return true;
  } catch (error) {
    console.log('Print error:', error);
    return false;
  }
}

interface BusinessInfo {
  businessName: string;
  businessLogo: string | null;
  businessPhone: string;
  businessWebsite: string;
  returnAddress: string;
}

/**
 * Prepare order label data from an order object
 */
export function prepareOrderLabelData(
  order: {
    orderNumber: string;
    websiteOrderReference?: string;
    customerName: string;
    customerPhone?: string;
    deliveryAddress?: string;
    deliveryState?: string;
    logistics?: {
      carrierName?: string;
    };
  },
  business: BusinessInfo
): OrderLabelData {
  // Combine address with state
  const fullAddress = [order.deliveryAddress, order.deliveryState]
    .filter(Boolean)
    .join(', ');

  return {
    businessName: business.businessName,
    businessLogo: business.businessLogo,
    businessPhone: business.businessPhone,
    businessWebsite: business.businessWebsite,
    returnAddress: business.returnAddress,
    orderNumber: order.orderNumber,
    websiteOrderRef: order.websiteOrderReference,
    customerName: order.customerName,
    customerPhone: order.customerPhone || '',
    deliveryAddress: fullAddress,
    logisticsProvider: order.logistics?.carrierName,
  };
}
