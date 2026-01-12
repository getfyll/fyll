import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { generateOrderLabelHTML, OrderLabelData } from '@/components/labels/OrderLabel80x90';

/**
 * Print shipping label for an order (80mm x 90mm)
 * Opens the device's native print dialog
 */
export async function printOrderLabel(data: OrderLabelData): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const html = generateOrderLabelHTML(data);

    // Print the label using expo-print
    // The html content ensures only the label is printed, not the app UI
    await Print.printAsync({
      html,
      width: 227, // 80mm in points (1mm ≈ 2.83 points)
      height: 255, // 90mm in points
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
