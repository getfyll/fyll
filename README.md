# Fyll v13.0 - Streamlined Order & Inventory Management

A lean, focused inventory and order management app for SMBs in Nigeria, built with React Native and Expo. Features proper **Dark/Light Mode** support with automatic theme switching.

## v13.30 Updates

### Removed All Entry Animations
Removed all `react-native-reanimated` animations from all screens for faster, cleaner UI:
- Home screen (tabs/index.tsx) - Removed FadeInDown, FadeInRight animations
- Order detail (order/[id].tsx) - Removed FadeInDown animations from all sections
- Product detail (product/[id].tsx) - Removed FadeInDown, FadeInRight animations
- New order (new-order.tsx) - Previously cleaned
- New product (new-product.tsx) - Previously cleaned

### Product Detail Page Improvements
Several UI enhancements to the single product page:

**Stock Value Text Color**
- Changed from emerald green to black for better consistency with the design system

**Compact Variants List**
- Redesigned variant cards to be more compact and modern
- Single row layout with image, name, stock badge, and actions
- Bottom row with price, compact restock button, and stock adjustment controls
- Reduced padding and margins for denser information display

**Smaller Restock Button**
- Changed from full-width button to compact inline button
- Now sits alongside stock adjustment controls
- Green background with "Restock" text and icon

**Dynamic Edit Variant Modal**
- Edit Variant popup now respects app's light/dark mode setting
- Uses `themeColors` hook for all colors
- Background, text, inputs, and buttons all adapt to theme
- Save button inverts colors based on theme (white bg in dark, black bg in light)

### Logistics Calendar Update
Changed the logistics pickup date picker to match the order date calendar style:
- Replaced native `DateTimePicker` with custom calendar grid
- Works consistently on iOS, Android, and Web
- Month/year navigation with left/right chevron buttons
- Day grid with visual selection highlighting
- Today highlighted in blue, selected date in black
- Clear and Done buttons at bottom
- No more blank/invisible calendar content issues

### Home Screen Active Orders (Already Dynamic)
The Active Orders metric on the home screen was already dynamic, pulling from `stats.pendingOrders` which counts non-delivered, non-refunded orders.

## v13.29 Updates

### Order Date Calendar Picker Fix
Fixed the Order Date picker in New Order screen that was showing blank/invisible content:

**Issues Fixed:**
- Calendar picker content not visible (white-on-white or gray-on-gray)
- Native wheel picker not rendering properly on web
- Modal overlay reducing opacity of picker content

**Solution:**
- Replaced native DateTimePicker with a custom calendar grid component
- Calendar works identically on iOS, Android, and Web
- Clear month/year navigation with left/right arrows
- Day selection with visual highlighting for today and selected date
- Future dates are disabled (cannot select dates after today)
- "Done" button to confirm selection

### Sticky Bottom CTA for New Order
Updated the New Order screen with improved submission UX:

**Changes:**
- **Removed Header Button**: The small top-right "Create" button has been removed
- **Sticky Bottom CTA**: Full-width "Create Order" button fixed above safe area
- **Button Styling**: Black brand color, 52px height, rounded corners
- **Disabled State**: Button disabled until required fields are valid (customer name, at least one item)
- **Loading State**: Shows spinner with "Creating..." during submission
- **Bottom Padding**: Form content has extra padding to prevent CTA overlap

### Fixed Modal Scrolling
Fixed stuck/laggy scrolling inside modals and popups (State Selection, Service Selection, Source Selection, Payment Method):

**Issues Fixed:**
- Scrolling becoming stuck or unresponsive after opening modals
- Users having to "fight" the scroll for a few seconds before it moves
- Gesture conflicts between overlay and scroll container

**Solution:**
- Changed modal structure to use View wrapper instead of nested Pressable for overlay
- Added absolute positioned Pressable for background dismiss
- Added `bounces={true}` and `overScrollMode="always"` to ScrollViews
- Added `keyboardShouldPersistTaps="handled"` consistently
- Applied same fix to modals in:
  - `new-order.tsx` - State, Service, Source, Payment Method modals
  - `product/[id].tsx` - Edit Product, Add Variant, Edit Variant modals
  - `new-product.tsx` - Variant Value Selection modal

## v13.28 Updates

### Unified Button Design System
Created a unified Button component (`src/components/Button.tsx`) for consistent CTAs across the app.

**Button Variants:**
- `primary`: Black background, white text (default) - for main CTAs like Create, Save, Submit
- `secondary`: Gray background, dark text - for Cancel, secondary actions
- `danger`: Red background, white text - for destructive actions like Delete, Refund
- `danger-ghost`: Light red background, red text - for soft delete warnings
- `ghost`: Transparent with border - for tertiary actions

**Button Sizes:**
- `sm`: 40px height, 14px font - for inline/header buttons
- `md`: 48px height, 15px font - for medium CTAs
- `lg`: 52px height, 16px font (default) - for primary full-width CTAs

**Features:**
- `loading` state with spinner and optional `loadingText`
- `disabled` state with reduced opacity
- `icon` prop for leading icons
- `fullWidth` prop (default true)
- `haptic` feedback on press (disabled on web)

**Helper Component:**
- `StickyButtonContainer`: Wrapper for sticky bottom CTAs with safe area support

**Updated Screens:**
- `new-product.tsx`: Create Product button
- `new-order.tsx`: Create button
- `order/[id].tsx`: Save Changes, Save Logistics, Process Refund, Print Shipping Label, Delete Order
- `product-variables.tsx`: Add Variable, Create/Cancel buttons

**Usage Example:**
```tsx
import { Button, StickyButtonContainer } from '@/components/Button';

// Primary CTA
<Button onPress={handleSubmit}>Create Product</Button>

// With loading state
<Button loading={isLoading} loadingText="Creating...">Create</Button>

// Secondary variant
<Button variant="secondary" onPress={handleCancel}>Cancel</Button>

// Danger variant with icon
<Button variant="danger-ghost" icon={<Trash2 />}>Delete</Button>

// Sticky bottom CTA
<StickyButtonContainer bottomInset={insets.bottom}>
  <Button onPress={handleSubmit}>Save Changes</Button>
</StickyButtonContainer>
```

## v13.27 Updates

### Logistics Pickup Calendar Fix
Fixed the Logistics Pickup Date picker to work correctly across all platforms:

**Issues Fixed:**
- Date picker not mounting on web (was using native-only component)
- Modal z-index issues on iOS preventing date picker visibility
- Missing web fallback for date selection

**Changes Made:**
- **Web Fallback**: Added HTML5 date input for web platform with proper styling
- **iOS Modal**: Date picker now opens in a dedicated modal with proper z-index
- **Android Support**: Native date picker dialog closes automatically on selection
- **Debug Logging**: Added console logs for tracking calendar open/save/select events
- **Haptics Fix**: Wrapped Haptics calls with Platform checks for web compatibility

**How It Works:**
- On iOS: Tap the date field to open a spinner picker in a modal
- On Android: Tap the date field to open native date picker dialog
- On Web: Click the date field to use browser's native date picker

**Also Fixed:** Refund date picker with the same cross-platform approach

## v13.26 Updates

### Order Date Control on New Order Screen
Added an Order Date control to the New Order screen for accurate date tracking and stats:
- **Default**: "Today" is selected by default
- **Toggle UI**: Segmented control with "Today" and "Another Day" options
- **Date Picker**: When "Another Day" is selected, shows a date picker
  - iOS: Native spinner date picker in modal
  - Android: Native date picker dialog
  - Web: HTML5 date input with proper styling
- **Maximum Date**: Cannot select future dates (limited to today)
- **Timezone Safe**: Stores ISO string; renders in user's locale
- **New Field**: `orderDate` field added to Order interface for stats/time grouping
- **Backwards Compatible**: Existing orders use `createdAt` if `orderDate` is not set

## v13.25 Updates

### New Product Screen - Sticky Bottom CTA
Updated the New Product screen with an improved submission flow:
- **Removed Header Button**: The "Create" button in the top-right header has been removed for a cleaner interface
- **Sticky Bottom CTA**: Full-width "Create Product" button that stays fixed above the safe area
- **Button Styling**: Black primary button with 52px height, rounded corners consistent with design system
- **Disabled State**: Button is gray and disabled until all required fields are valid (name, at least one variant with image)
- **Loading State**: Shows spinner with "Creating..." text during submission
- **Success Toast**: Animated toast notification appears at the top after successful creation
- **Auto Navigation**: Returns to Inventory list 800ms after successful creation
- **Web Compatibility**: All Haptics calls wrapped with Platform checks for web support

## v13.24 Updates

### Responsive Split View / Panel View Layout
Implemented a responsive Split View layout for tablet and desktop (web/PWA) users.

**Breakpoints**
- Mobile (<768px): Traditional full-page navigation with bottom tabs
- Tablet (>=768px): Split View with collapsible detail panel, bottom tabs visible
- Desktop (>=1024px): Split View with persistent detail panel, sidebar navigation replaces bottom tabs

**New Components**
- `useBreakpoint()` hook (`src/lib/useBreakpoint.ts`): Detects current breakpoint (mobile/tablet/desktop)
- `SplitViewLayout` (`src/components/SplitViewLayout.tsx`): Master-detail split view container with animated panels
- `DesktopSidebar` (`src/components/DesktopSidebar.tsx`): Left sidebar navigation for desktop layout
- `ProductDetailPanel` (`src/components/ProductDetailPanel.tsx`): Product details for split view
- `OrderDetailPanel` (`src/components/OrderDetailPanel.tsx`): Order details for split view
- `CustomerDetailPanel` (`src/components/CustomerDetailPanel.tsx`): Customer details for split view

**Screens Updated**
- Inventory: Click product to show details in side panel (tablet/desktop) or navigate (mobile)
- Orders: Click order to show details in side panel (tablet/desktop) or navigate (mobile)
- Customers: Click customer to show details in side panel (tablet/desktop)

**Detail Panel Features**
- Image preview with tap-to-enlarge modal
- Key fields summary with real-time data
- Action buttons (Edit, Restock, Print Label, Update Status, etc.)
- Independent scrolling from master list
- Animated slide-in/slide-out transitions

**Desktop Navigation**
- Bottom tabs hidden on desktop (>=1024px)
- Left sidebar with all navigation items
- User profile and sign out at bottom
- Role-based menu visibility (Insights hidden for non-admin users)

**Layout Behavior**
- Master pane width adjusts based on whether detail is open
- Content max-width for readability on wide screens
- Proper padding and spacing for desktop layouts

## v13.23 Updates

### Discount Code Support for Orders
- **New Field**: `discountCode` (string) and `discountAmount` (number) added to Order model
- **New Order Screen**: Discount code and discount amount fields added to Fees & Charges section
- **Order Summary**: Shows discount with code in green, subtracted from total
- **Order Details**: Displays discount row with percentage icon in green
- **Edit Order**: Can add/edit discount code and amount on existing orders
- **Proper Calculation**: Total = Subtotal + Delivery + Additional Charges - Discount

### Print Label Fix (80x90mm Shipping Label)
- **Improved Print CSS**: Enhanced @media print rules for proper 80x90mm label printing
- **Title Added**: HTML title helps identify print jobs
- **Print-Only Styles**: Added explicit `!important` rules to ensure only label content prints
- **Screen vs Print Separation**: Different styles for screen preview vs actual print output

### Add Variant Modal - Dynamic Theme Support
- **Light/Dark Mode**: Add Variant popup now respects app theme setting
- **Uses Theme Hook**: Modal uses `useThemeColors()` for all colors
- **Consistent UI**: Input fields, buttons, dropdowns all adapt to theme
- **Button Inversion**: Primary button inverts colors based on theme (white bg in dark, black bg in light)

### Product Barcode Label - Removed Pricing
- **No Price on Label**: Product barcode labels no longer display price
- **Cleaner Layout**: Label shows only barcode, SKU, and product name
- **Preview Updated**: Label preview screen also hides price
- **Label Content Section**: Removed price from LABEL CONTENT display

## v13.22 Updates

### Sorting & Filtering for Inventory and Orders
Added comprehensive sort options to both Inventory and Orders screens via the filter button.

**Inventory Screen Sorting**
- Name (A-Z) - alphabetical ascending (default)
- Name (Z-A) - alphabetical descending
- Newest First - by creation date
- Oldest First - by creation date
- Stock: Low to High - products with least stock first
- Stock: High to Low - products with most stock first

**Orders Screen Sorting**
- Newest First - most recent orders (default)
- Oldest First - oldest orders first
- Customer (A-Z) - alphabetical by customer name
- Customer (Z-A) - reverse alphabetical
- Amount: High to Low - highest value orders first
- Amount: Low to High - lowest value orders first

**UI Updates**
- Filter button now shows count of active filters/sorts
- Combined "Filter & Sort" modal with separate sections
- Apply button to confirm selections
- Haptic feedback on selection changes

**Files Updated**
- `src/app/(tabs)/inventory.tsx` - Added sortBy state and sorting logic
- `src/app/(tabs)/orders.tsx` - Added sortBy state and sorting logic

## v13.21 Updates

### Global Low Stock Threshold Setting
Added a new setting to apply a single low stock threshold across all products, instead of managing individual thresholds per product.

**New Feature**
- **Toggle**: Enable/disable global low stock threshold in Settings > Inventory
- **Threshold Input**: Set a single threshold value (default: 5 units) that applies to all products
- **Override Behavior**: When enabled, overrides individual product thresholds everywhere in the app

**Where It Applies**
- Dashboard low stock alerts
- Inventory screen low stock filtering and counts
- Stats/Insights inventory analytics (low stock items count)
- Inventory Today drill-down screen

**Files Updated**
- `src/lib/state/fyll-store.ts` - Added `useGlobalLowStockThreshold`, `globalLowStockThreshold`, and setter functions
- `src/app/(tabs)/settings.tsx` - Added Global Low Stock Alert toggle with threshold input
- `src/lib/inventory-analytics.ts` - Updated `computeInventoryAnalytics`, `calculateInventoryOverview`, `getLowStockItems` to accept optional global threshold
- `src/app/(tabs)/insights.tsx` - Passes global threshold to inventory analytics
- `src/app/(tabs)/inventory.tsx` - Uses global threshold for filtering and display
- `src/app/(tabs)/index.tsx` - Uses global threshold for dashboard low stock alerts
- `src/app/insights/inventory-today.tsx` - Uses global threshold for inventory overview

## v13.20 Updates

### Light Mode UI Refinement (Stats + Internal Screens)
Improved light mode visual clarity with a clean, flat, modern card-based layout.

**What Changed**
- **Background**: App background changed from white (#FFFFFF) to light neutral grey (#F7F7F7)
- **Cards**: White cards (#FFFFFF) with subtle 1px border (#E6E6E6) instead of heavy shadows
- **No Shadows in Light Mode**: All card shadows removed in light mode for cleaner appearance
- **Dark Mode Preserved**: Dark mode retains existing styling (no changes)

**Theme System Updates**
- Added `card` object to `useStatsColors()` with `borderWidth`, `borderColor`, `shadowOpacity`
- Added `getCardStyle()` helper function for consistent card styling
- Light mode: `borderWidth: 1`, `borderColor: #E6E6E6`, `shadowOpacity: 0`
- Dark mode: `borderWidth: 0`, `borderColor: transparent`, `shadowOpacity: 0.3`

**Files Updated**
- `src/lib/theme.ts` - Updated light mode colors and added card styling helpers
- `src/app/(tabs)/insights.tsx` - All cards use new card styling
- `src/app/insights/*.tsx` - All 14 drill-down screens updated
- `src/components/stats/BreakdownTable.tsx` - Uses `getCardStyle()`

### Fixed "Mark as New Design" Toggle Visibility
The toggle was almost invisible in its OFF state (white track on white background).

**What Changed**
- **Label Text**: Increased from `text-sm font-medium` to `text-base font-bold` to match other toggles
- **Track Color (OFF state)**: Changed from `#E5E5E5` to `#767577` (visible grey) on light screens
- **Track Color (Dark modal)**: Changed from `#333333` to `#555555` for better visibility
- **Thumb Color**: Updated to white (`#FFFFFF`) in both states for consistency

**Files Updated**
- `src/app/new-product.tsx` - New Product screen toggle
- `src/app/product/[id].tsx` - Edit Product modal toggle

## v13.19 Updates

### Fixed New Product Variant Card Rendering
Fixed the bug where tapping "+ Add" under Product Variants created empty space but the variant card was not visible.

**What Changed**
- **Animation Fix**: Changed `SlideInRight` animation to `FadeInDown` for variant cards - the slide animation was causing rendering issues inside `KeyboardAwareScrollView`
- **Separate Conditionals**: Split the ternary rendering logic into separate conditional blocks so the empty state and variant list render independently
- **Reliable Rendering**: Variant cards now appear immediately and are fully visible when added
- **Scrollable**: Variants list properly scrolls with dynamic height
- **Theme Support**: Works correctly in both light and dark modes

**Technical Details**
- Replaced `SlideInRight.springify()` with `FadeInDown.duration(300).delay(index * 50)` for smoother, more reliable animations
- Removed `exiting={SlideOutRight.springify()}` which could cause layout issues
- Changed from ternary `{variants.length === 0 ? ... : ...}` to separate `{variants.length === 0 && ...}` and `{variants.map(...)}` blocks

## v13.18 Updates

### Stats/Insights Theme Support
Fixed theming so Stats (Insights) and all internal screens respect the system/app theme (Light/Dark mode).

**What Changed**
- **Main Insights Screen**: Now uses `useStatsColors()` hook from theme system
- **All 17 Drill-Down Screens**: Updated to use theme-aware colors
- **Stats Components**: `BreakdownTable`, `DetailHeader`, `SalesBarChart` now respect theme
- **Theme System**: Added `useStatsColors()` hook to `@/lib/theme` for consistent stats colors

**Light Mode**
- Light backgrounds, white cards, dark text
- Charts use dark bars on light grid

**Dark Mode**
- Dark backgrounds (#111, #1A1A1A), white text
- Charts use white bars on dark grid

**Files Updated**
- `src/app/(tabs)/insights.tsx` - Main stats screen
- `src/app/insights/*.tsx` - All drill-down screens (17 files)
- `src/components/stats/BreakdownTable.tsx`
- `src/components/stats/DetailHeader.tsx`
- `src/components/stats/SalesBarChart.tsx`
- `src/lib/theme.ts` - Added `useStatsColors()` hook

## v13.17 Updates

### Discontinue Candidates / Slow Movers Section
Helps decide which products to stop restocking with intelligent filtering.

**Definition**
Products qualify as discontinue candidates when:
- Current stock >= X (configurable threshold, default 5)
- Zero units sold in the selected period

**Data Model**
- `isDiscontinued` (boolean): Mark products as discontinued
- `discontinuedAt` (date): Auto-set when first marked as discontinued

**Product UI**
- **Edit Product**: "Mark as Discontinued" toggle with warning info
- **Product Header**: Red "DISCONTINUED" badge on discontinued products

**Inventory Insights Section**
- Period selector: 30 days / 90 days / This Year
- Stock threshold selector: 5+ / 10+ / 20+
- Summary showing total discontinue candidates count
- List showing:
  - Product name (with "DISCONTINUED" badge if marked)
  - Current stock units
  - Restocks this year
  - Last sold date
- "View all" link to full drill-down

**Drill-Down Screen** (`/insights/discontinue-candidates`)
- Full list with all filtering options
- Period selector (30d / 90d / Year)
- Stock threshold selector (1+ / 3+ / 5+ / 10+ / 20+)
- Top 20 / Top 50 toggle
- Info banner with clearance suggestions
- Tappable rows navigate to Product Details
- Shows discontinued status per product

**New Order Behavior**
- Discontinued products are hidden from the product picker when creating new orders
- Existing orders with discontinued products are not affected

## v13.16 Updates

### New Design Tracking for Yearly Reviews
Track new product designs for yearly reviews with manual tagging support.

**Data Model**
- `isNewDesign` (boolean): Mark products as new designs
- `designYear` (number): Year of the design (defaults to current year)
- `designLaunchedAt` (date): Auto-set when first marked as new design

**Product UI**
- **Add Product**: "Mark as New Design" toggle with year input
- **Edit Product**: Same toggle in edit modal
- **Product Cards**: Blue "New {year}" badge on inventory list

**Inventory Insights - New Designs Section**
- Year selector (toggle between years)
- Stats grid showing:
  - New designs added (count)
  - New designs restocked (count)
  - Total restocks for new designs
  - Total units restocked for new designs
- Top Restocked list with "View all" link

**Drill-Down Screens**
- `/insights/new-designs?year={year}`: All new designs for selected year
  - Shows: product name, stock, units sold, restock count, units restocked
  - Sort by: restocks, sales, or stock
  - Year selector
- `/insights/top-restocked-new-designs?year={year}`: Top restocked new designs ranked list

## v13.15 Updates

### Inventory Insights Drill-Down Pages
Added "View all" drill-down pages for Inventory Insights lists:

**Best Sellers Screen** (`/insights/best-sellers`)
- Full ranked list of products by units sold
- Time filter: Last 7 days / Last 30 days / This Year
- Toggle between Top 20 and Top 50
- Shows stock remaining and stock cover days
- Tappable rows navigate to Product Details

**Top Revenue Screen** (`/insights/top-revenue`)
- Full ranked list of products by revenue
- Same time filter and limit options
- Shows units sold per product

**Most Restocked Screen** (`/insights/most-restocked`)
- Products ranked by restock frequency
- Toggle sort by: Restock Count or Units Restocked
- Same time filter and limit options

**Slow Movers Screen** (`/insights/slow-movers`)
- Products with lowest sales (worst sellers)
- Shows current stock count to identify dead stock
- Warning banner with clearance suggestions
- Red highlight for products with zero sales

### Slow Movers Section in Inventory Tab
- New "Slow Movers" card showing products with lowest sales
- Shows stock count to spot dead stock
- Color-coded: orange for low sales, red for no sales
- "View all" link to full slow movers list

### View All Links
All Inventory Insights sections now have "View all" links:
- Best Sellers (by units)
- Top Revenue Products
- Most Restocked
- Slow Movers

### No Duplicate Headers
All new drill-down screens use `headerShown: false` to prevent duplicate back buttons.

## v13.14 Updates

### Re-enabled Variant Image Upload
- **Per-Variant Images**: Each variant can now have its own optional image (e.g., different colors)
- **Web-Safe**: Uses the same `useImagePicker` hook that works reliably on web and native
- **Fallback to Product Image**: If variant has no image, automatically uses product image
- **Visual Indicator**: Variants with custom images show a small green dot on their thumbnail
- **Error Handling**: All image operations wrapped in try/catch with loading states

### Edit Variant Modal
- **Image Section**: New "Variant Image" section at top of edit modal
- **Add/Change/Remove**: Can add, change, or remove variant-specific images
- **Clear Guidance**: Helper text explains the fallback behavior
- **Loading States**: Proper loading indicators during image selection

### Variant List Display
- **Image Thumbnails**: Variants now show 44x44 image thumbnails
- **Smart Fallback**: Shows variant image if set, otherwise shows product image
- **Custom Image Indicator**: Green dot badge indicates variant has its own image (not inherited)

## v13.13 Updates

### Fixed Inventory Product Image Upload
- **Web-Safe Image Picker**: Created `useImagePicker` hook (`src/hooks/useImagePicker.ts`) that works reliably on web and native
- **No More UI Freeze**: Image picker now uses standard file input on web, preventing the UI freeze issue
- **Single Code Path**: Both product create and edit screens use the same image picker hook
- **Proper Error Handling**: All image picker operations wrapped in try/catch with loading states
- **Cancel Always Works**: Modal can always be closed even if image picker fails

## v13.12 Updates

### Inventory Tab in Stats/Insights
New Inventory analytics tab providing insights using existing product, order, and restock log data:

**Overview Cards (6 KPIs)**
- Total Products (count)
- Total Variants (count)
- Total Units In Stock (sum of all variant quantities)
- Total Inventory Value (sum of quantity × unit price)
- Low Stock Items (count below alert threshold)
- Out of Stock Items (count == 0)

**Restock Insights**
- Restocks Over Time bar chart (by day/week/month based on filter)
- Total Restocks count and Units Restocked in period
- Most Restocked Products (top 5 by restock event count)
- Most Restocked by Units (top 5 by total units added)

**Sales-Linked Product Performance**
- Best-selling Products (top 5 by units sold in period)
- Top Products by Revenue (top 5 by revenue in period)
- Stock Cover Days indicator (days of stock remaining based on recent sales rate)

**Low Stock & Out of Stock Lists**
- Low stock items with current stock and threshold
- Out of stock items list
- Tappable rows navigate to product detail screen

**Time Filters**
- Last 7 days / Last 30 days / This Year
- All metrics recompute based on selected period

## v13.11 Updates

### Team Member Accounts
Complete team management system for multi-staff operations:

**Team Management (Settings → Team)**
- View all team members with roles and last login
- Create invites with email and role assignment
- Edit member details (name, email, role, password)
- Remove team members (except last admin)
- Three roles: Admin (full access), Manager (inventory/orders), Staff (basic operations)

**Authentication**
- Login screen with email/password
- Invite code flow for new staff
- Automatic redirect to login when not authenticated
- Session persistence across app restarts

**Staff Attribution**
- Orders show "Created by" and "Last updated by" staff names
- Products track who created them
- Restock logs show who performed the restock
- Order Details screen displays Staff Activity section

**Role-Based Permissions**
- Admin: Full access including Insights, Team management, Settings
- Manager: Inventory management, Order processing, Restocks
- Staff: QR scanning, Inventory checks, Order creation

**Note on Data Sharing**
Current implementation stores data locally per device. For true cross-device data sharing between team members, connect a backend (Firebase, Supabase) via Vibecode API tab.

## v13.10 Updates

### Product Image Support
- **Data Model**: Added optional `imageUrl` field to `Product` and `ProductVariant` types
- **Add Product Screen**: Image section with options to take photo (camera) or upload from gallery
- **Edit Product Screen**: Image section in edit modal with change/remove options
- **Inventory List**: Product cards display thumbnail image if available, with clean Package icon placeholder if not
- **Image Picker**: Bottom sheet modal for selecting camera or gallery as image source
- **Storage**: Images stored using expo-image-picker URIs

### Variant Image Support
- **Per-Variant Images**: Each variant can have its own optional image (e.g., different colors)
- **Edit Variant Modal**: Image picker section to add/change/remove variant images
- **Graceful Fallback**: If no variant image, no thumbnail shown (keeps UI clean)

### Robust Image Picker Error Handling
- **Try/Catch Wrapping**: All image picker operations wrapped in try/catch/finally blocks
- **Loading State**: Visual loading indicator while image picker is processing
- **Error Toast**: Clear error messages displayed when image picker fails (e.g., permission denied, device incompatibility)
- **Cancel Button**: Edit modals include Cancel button to ensure user can always close
- **No UI Freeze**: Image picker errors are caught gracefully, preventing app freeze

### List Divider Fix
- Removed double divider lines at bottom of list cards (Inventory variants, Home recent orders)
- Single divider now only appears between items, not after the last item

### Sales by Source Card Update
- Updated Home "Sales by Source" card to match Stats page horizontal bar styling
- Thick monochrome bars with rounded ends
- Shows source name, count, and percentage
- Added "View All" button navigating to `/insights/platforms`
- Uses `getPlatformBreakdown()` from analytics-utils for consistent data

## v13.9 Updates

### In-App PDF Viewer for Prescriptions
- **PDF Viewer Screen**: Full-screen PDF viewer for prescription documents
- **WebView Rendering**: Uses Google Docs Viewer for reliable PDF display on iOS Safari and Android Chrome
- **Zoom Controls**: Zoom in/out buttons with percentage indicator (50%-300%)
- **Fallback Support**: "Open in Browser" button if PDF cannot be rendered in-app
- **Local File Support**: Graceful handling of local blob URLs with external viewer option
- **Navigation**: Tapping a PDF prescription now opens the PDF viewer instead of showing "PDF preview not available"

### New Components
- `PdfViewer` (`src/components/PdfViewer.tsx`): Reusable PDF viewer component with WebView, zoom controls, and fallback handling

### New Routes
- `pdf-viewer` (`src/app/pdf-viewer.tsx`): Full-screen modal route for viewing PDF documents
  - Accepts `uri` (required) and `fileName` (optional) query parameters

### Updated Components
- `PrescriptionSection`: Now navigates to PDF viewer screen for PDF files instead of showing "not available" message

## v13.8 Updates

### Prescription Details Support
- **New Section**: "Prescription" section on Order Details screen (internal use only)
- **Two Input Options**:
  - **Upload File**: Accept images (JPG, PNG) or PDF prescriptions
  - **Text Entry**: Multiline text field for manual prescription details
- **Flexible Input**: Either file or text is sufficient; both can be provided if needed
- **Data Storage**:
  - `prescriptionFileUrl`: URL/URI of uploaded prescription file
  - `prescriptionText`: Manual text entry for prescription details
  - `uploadedAt`: Timestamp when prescription was added
  - `uploadedBy`: User/staff who uploaded the prescription
- **Preview Features**:
  - Image thumbnail preview with full-screen view on tap
  - PDF icon display for PDF files
  - Readable text block for entered prescription details
- **Edit/Replace**: Staff can edit or replace prescription data anytime
- **Empty State**: Shows subtle "No prescription added" when no data exists
- **Access Control**: Internal only - not customer-facing

### New Components
- `PrescriptionSection` (`src/components/PrescriptionSection.tsx`): Complete prescription management UI
  - File upload (image picker + document picker)
  - Text entry with multiline input
  - Preview modal for full image viewing
  - Edit/remove functionality

### Updated Types
- `PrescriptionInfo` interface added to `fyll-store.ts`
- `Order` interface extended with optional `prescription` field

## v13.7 Updates

### Business Settings (MVP)
- **New Screen**: Settings > Business Settings for configuring business identity
- **Business Name**: Required field with validation (cannot be empty)
- **Business Logo**: Optional image upload with preview, supports square images
- **Business Phone**: Phone number for shipping labels
- **Business Website**: Website URL for shipping labels
- **Return Address**: Multiline address field for shipping label sender block
- **Persistent Storage**: Settings saved via AsyncStorage
- **Global Access**: New `useBusinessSettings()` hook available throughout the app

### New Hook: useBusinessSettings (`src/hooks/useBusinessSettings.ts`)
- `businessName`: Current business name string
- `businessLogo`: URI string or null for logo image
- `businessPhone`: Business phone number
- `businessWebsite`: Business website URL
- `returnAddress`: Return address for shipping labels
- `isLoading`: Loading state while fetching from storage
- `updateBusinessName(name)`: Update business name with validation
- `updateBusinessLogo(uri)`: Update or clear logo
- `saveSettings(partial)`: Save multiple settings at once

### Dashboard Greeting Update
- **Dynamic Business Name**: Welcome message now shows Business Name from settings
- **Fallback**: If no business name is set, shows only "Welcome back"

### Print Shipping Label (80mm x 90mm)
- **New Button**: "Print Shipping Label" button on Order Details screen
- **Label Size**: 80mm x 90mm, optimized for thermal printers
- **Order Number Hierarchy**:
  - **With Website Order Ref**: Shows as primary ("ORDER #56844"), FYLL ref shown above QR code
  - **Without Website Order Ref**: FYLL order number shown as primary with "INTERNAL ORDER" label
  - **QR Code**: Always encodes the internal FYLL order number (never the website order)
- **Courier-style Layout**:
  - **Sender Block** (top): Logo, Business Name, Phone, Website, Return Address
  - **Order Block** (center): Primary order number (large), with clear label
  - **Recipient Block**: Customer Name, Phone, Delivery Address (tight line spacing)
  - **Footer**: Logistics Provider badge (left), FYLL REF + QR code (right)
- **Logo Handling**: If logo is missing or fails to load, displays text-only gracefully
- **Print CSS**: @page { size: 80mm 90mm; margin: 0; }
- **High Contrast**: Black text on white background, thermal-printer friendly
- **Left-aligned Layout**: Clean courier label aesthetic, not centered card style

### New Components
- `OrderLabel80x90Preview` (`src/components/labels/OrderLabel80x90.tsx`): Visual preview component
- `generateOrderLabelHTML()`: HTML generator for print-ready labels

### New Utilities
- `printOrderLabel()` (`src/utils/printOrderLabel.ts`): Triggers native print dialog
- `prepareOrderLabelData()`: Extracts label data from order objects

## v13.6 Updates

### Website Order Reference (WooCommerce Integration)
- **New Field**: `websiteOrderReference` added to Order model for WooCommerce integration
- **Order Details**: Displays "Website Order Ref: WC #10234" below order date (when present)
- **Order Create**: New optional field "Website Order Ref (WooCommerce)" on new order screen
- **Order Edit**: Field available in edit modal to add/update reference after creation
- **Graceful Handling**: Empty values handled cleanly - no placeholder text shown when empty
- **Available Everywhere**: Field accessible to labels, analytics, and barcode features

## v13.5 Updates

### Stats Drill-Down Navigation
- **Clickable Cards**: Each major card on the Stats screen is now tappable with chevron indicator
- **9 Detail Screens**: New insight detail pages under `/insights/*`:
  - `/insights/today` - Today's summary with hourly activity breakdown
  - `/insights/sales` - Revenue analytics with larger charts and breakdowns
  - `/insights/orders` - Order volume, fulfillment status, top orders
  - `/insights/customers` - New vs returning, top customers by spend
  - `/insights/refunds` - Refund breakdown with revenue impact
  - `/insights/locations` - Geographic customer distribution
  - `/insights/platforms` - Sales channel performance
  - `/insights/logistics` - Carrier performance metrics
  - `/insights/addons` - Add-on/service revenue breakdown
- **Consistent Design**: All detail screens use dark monochrome theme matching Stats
- **Back Navigation**: DetailHeader component with back button and Export placeholder
- **Breakdown Tables**: BreakdownTable component for detailed data lists
- **Time Range Filters**: Each detail screen has independent time range selector

### New Components
- `DetailHeader` (`src/components/stats/DetailHeader.tsx`): Reusable header with back button, title, subtitle, and export button
- `BreakdownTable` (`src/components/stats/BreakdownTable.tsx`): Reusable table component for detailed data breakdowns

## v13.4 Updates

### Fixed Refund Analytics (Partial Refunds Support)
- **Partial Refund Detection**: Refunds now count any order with refundedAmount > 0 (not just status-based)
- **Accurate Refund Count**: `refundsCount` = number of unique orders with any refund amount
- **Accurate Refund Total**: `refundsAmount` = sum of all refunded amounts in selected date range
- **Net Revenue**: New field `netRevenue` = Gross Revenue - Refund Total, displayed on Sales tab
- **Resilient Logic**: Handles missing fields safely, supports multiple refund storage patterns

### New Helper: `getRefundedAmount(order)` (`src/lib/analytics-utils.ts`)
- Safely extracts total refunded amount from an order
- Supports multiple patterns: `order.refund?.amount`, `order.refundedAmount`, `order.partialRefunds[]`, `order.refunds[]`
- Returns 0 if no refund data exists

### New Helper: `getRefundStats(orders)` (`src/lib/analytics-utils.ts`)
- Returns `{ count, total }` for orders with any refund
- Used by `useAnalytics` and `getTodayStats`

### Updated KPIs
- **Sales Tab**: Now shows proper Net Revenue using the new `netRevenue` field
- **Orders Tab**: "Refunded" count now uses `refundsCount` (partial-aware)
- **Today's Stats**: Now includes `todayRefundsAmount`

## v13.3 Updates

### Tab-Specific KPI Tiles (2x2 Grid)
- **4 KPIs Per Tab**: Each tab now shows exactly 4 tailored KPI cards in a 2x2 grid layout
- **Sales Tab KPIs**: Total Revenue, Net Revenue (Revenue - Refunds), Avg Order Value, Refund Total
- **Orders Tab KPIs**: Total Orders, Delivered, Processing, Refunded count
- **Customers Tab KPIs**: Unique Customers, New Customers, Returning Customers, Repeat Rate %
- **Consistent Layout**: Cards are visually identical in style and size across all tabs
- **Real Data**: All KPIs computed from actual analytics data

### Reduced Motion / No Animations
- **Instant Rendering**: Removed all FadeInDown entrance animations
- **Premium Dashboard Feel**: Page renders instantly without playful transitions
- **Performance**: Faster initial paint and better accessibility compliance

### Team Sync Feature
- **Cross-Account Sync**: New sync button in Stats header to share data across team accounts
- **Team Setup**: First-time setup prompts for team ID configuration
- **Sync Status Indicator**: Shows syncing, synced, or offline status
- **Auto-Sync Option**: Toggle automatic background synchronization
- **Local Config Storage**: Team configuration persisted via AsyncStorage

### New Hook: useTeamSync (`src/hooks/useTeamSync.ts`)
- `syncData()`: Trigger manual data sync
- `setupTeam()`: Configure team connection
- `disconnectTeam()`: Remove team configuration
- `toggleAutoSync()`: Enable/disable automatic sync

## v13.2 Updates

### Functional Stats Tabs (Sales | Orders | Customers)
- **Tab-Specific Content**: Each tab now shows completely different metrics and charts
- **Sales Tab**:
  - Revenue totals with trend chart
  - Average order value
  - Top add-ons by revenue
  - Revenue breakdown by source (WhatsApp, Instagram, etc.)
- **Orders Tab**:
  - Order count with trend chart
  - Fulfillment status breakdown (Processing, Delivered, Refunded, etc.)
  - Processing vs Delivered metrics
  - Logistics performance by carrier
- **Customers Tab**:
  - New vs Returning customers visualization
  - Top customers by total spend
  - Customer locations breakdown
  - Customer platforms breakdown
- **Preserved Time Range**: Selected time range (7d/30d/Year) persists across all tabs
- **Today's Summary**: Dynamic headline changes based on active tab

### New Analytics Utilities (`src/lib/analytics-utils.ts`)
- `getTopAddOns()`: Top services/add-ons by revenue
- `getRevenueBySource()`: Revenue breakdown by order source
- `getStatusBreakdown()`: Order status distribution with colors
- `groupOrdersByDay/Week/Month()`: Order count charts
- `getReturningVsNew()`: Customer retention analysis
- `getTopCustomers()`: Top customers by total spend
- `getCustomersByLocation/Platform()`: Customer demographics

## v13.1 Updates

### Real Analytics Data (No More Mock Data)
- **useAnalytics Hook**: New hook at `src/hooks/useAnalytics.ts` computes real stats from actual orders
- **Real-Time Metrics**:
  - **Sales Total**: Sum of paid order totals in selected range
  - **Orders Count**: Number of orders in range
  - **Units Sold**: Sum of quantities across all order items
  - **New Customers**: Count of unique customers whose first order is in range
  - **Refunds**: Count and total refunded amount from Refunded orders
- **Smart Chart Grouping**:
  - "Last 7 days": Groups sales by day (Mon-Sun)
  - "Last 30 days": Groups sales by week (W1-W4)
  - "This Year": Groups sales by month (Jan-Dec)
- **Period Comparison**: Calculates previous period and shows % change
- **Empty State**: Shows friendly "No Analytics Yet" message when no orders exist
- **Currency Formatting**: Consistent ₦ with commas throughout

### Analytics Utilities (`src/lib/analytics-utils.ts`)
- `formatAnalyticsCurrency()`: Format with ₦ and commas
- `formatCompactNumber()`: Compact numbers (1.2M, 45k)
- `percentChange()`: Calculate % change between periods
- `groupByDay()`, `groupByWeek()`, `groupByMonth()`: Chart data grouping
- `getLocationBreakdown()`, `getPlatformBreakdown()`, `getLogisticsBreakdown()`: Real breakdown data
- `getTodayStats()`: Today's sales, orders, units, customers, refunds
- `countNewCustomers()`: First-time customers in date range

## v13.0 Updates

### New Stats/Analytics Dashboard
- **Monochrome Dark Theme**: Premium near-black (#0B0B0B) background with white text and bars
- **Today Summary Card**: Big sales number with mini metrics (customers, orders, units, refunds) and sparkline chart
- **Sales Bar Chart**: Thick vertical bars (20px wide, rounded tops) with gridlines, period selector (7d/30d/Year)
- **KPI Tiles Row**: Horizontal scrolling cards with Sales, Customers, Orders, Refunds - each with trend indicators
- **Insights Breakdown Cards**:
  - Customer Location (computed from order delivery states)
  - Order Platforms (computed from order sources)
  - Logistics Performance (computed from order logistics data)
- **Interactive Time Range**: Toggle between Last 7 days, Last 30 days, This Year
- **Tab Navigation**: Sales | Orders | Customers tabs with underline indicator
- **Smooth Animations**: FadeInDown entrance animations for all cards

### New Components
- `SparklineChart`: Smooth curved sparkline with gradient fill
- `SalesBarChart`: Thick bar chart with SVG rendering
- `HorizontalBarChart`: Reusable horizontal bar component for breakdowns
- `MetricTile`: KPI card with trend indicator

## v12.9 Updates

### Integrated Restock System
- **Restock Button**: New green "Restock" button on Inventory list and Product Detail pages
- **Dedicated Restock Screen**: Full-screen restock flow with quantity input and quick-add buttons (+5, +10, +25, +50)
- **Restock Logs**: Every restock is logged with timestamp, quantity added, previous/new stock
- **Recent Restocks History**: Product Detail page shows last 3 restocks for that product
- **Stock Preview**: See the new stock level before confirming restock

### Team Management Improvements
- **Full-Screen Invite**: "Add Team Member" moved from modal to dedicated full-screen with KeyboardAwareScrollView
- **Three Roles**:
  - **Admin**: Full access to Revenue, Insights, Team Management, and Company Settings
  - **Manager**: Manage Inventory, Restocks, and Order History (no Insights tab)
  - **Staff**: Scan QR codes, Monthly Inventory Checks, and Add Orders only
- **Role-Based Permissions**: Each role has specific capabilities defined in ROLE_PERMISSIONS

### Role Permissions
| Permission | Admin | Manager | Staff |
|------------|-------|---------|-------|
| View Insights/Revenue | Yes | No | No |
| Manage Team | Yes | No | No |
| Edit Inventory | Yes | Yes | No |
| Restock | Yes | Yes | No |
| Process Orders | Yes | Yes | Yes |
| Scan QR | Yes | Yes | Yes |
| Inventory Checks | Yes | Yes | Yes |

## v12.8 Updates

### Team Management & Invitations
- **Invite Flow**: Admins can invite team members via email with invite codes
- **Pending Invites**: View and manage pending invitations with expiry countdown
- **Share/Copy Codes**: Share invite codes via native share sheet or copy to clipboard
- **Role-Based Tabs**: Insights tab automatically hidden for non-admin users
- **Invite Code Login**: New users can create accounts using invite codes from login screen

### Login Screen Updates
- **Join with Invite Code**: New option to join team using invite code
- **Two-Step Invite Flow**: Verify code first, then create account with name and password
- **Password Confirmation**: Requires password confirmation for new accounts

## v12.7 Updates

### UI Cleanup
- **Barcode Icon Removed**: Barcode icons removed from Product Edit and Add Product screens (kept in main search bars)
- **Hairline Separators**: All list separators now use thin 0.5px borders (#EEEEEE in light / #333333 in dark)
- **Metric Cards Removed**: Large horizontal cards removed from Order/Inventory lists for cleaner appearance

### Navigation Performance
- **Instant Navigation**: All screen transitions are instant with `animation: 'none'`
- **No Bounce/Spring**: All spring-based and bounce animations removed globally
- **Fast & Snappy**: Professional, instant screen transitions throughout

### Dark Mode Fix
- **Orders & Inventory Pages**: Now properly respect global dark/light theme
- **Dynamic Colors**: All pages use `useThemeColors()` hook for proper theme support
- **Search Bars & Filters**: All input components properly invert in dark mode
- **Dark Mode**: Black background (#111111), White text (#FFFFFF)
- **Light Mode**: White background (#FFFFFF), Black text (#111111)

### Keyboard Handling
- **Settings Screens**: All settings forms use `KeyboardAwareScrollView`
- **Category Manager**: Uses keyboard-aware scroll for text input
- **No Keyboard Overlap**: Text fields scroll into view when focused

### Category Management
- **Fully Functional**: Category Manager in Settings > Inventory works properly
- **Global Categories**: Categories saved to store and populate product forms
- **Add/Delete**: Users can add new categories and delete existing ones
- **Theme Support**: Category Manager respects dark/light theme

## v12.6 Updates

### User Authentication System
- **Login Screen**: Clean login page with email/password authentication
- **Demo Credentials**: admin@fyll.com / admin123 for testing
- **Session Persistence**: Auth state persisted via AsyncStorage
- **Logout**: Logout button in Settings with confirmation dialog
- **Protected Routes**: Auto-redirect to login when not authenticated

### Team Management (Admin Only)
- **Team Members Screen**: Admins can view and manage all team members
- **Full-Screen Invite**: Dedicated screen for inviting new team members
- **Pending Invites**: Track and manage pending invitations with expiry
- **Edit Members**: Update name, email, password, and role for existing members
- **Delete Members**: Remove team members (cannot delete self or last admin)
- **Role System**: Three roles - Admin, Manager, Staff with different permissions
- **Role-based Access**: Only admins can access Team Management and Insights

### Navigation Performance
- **No Animations**: All screen transitions use `animation: 'none'` for instant navigation
- **No Bounce Effects**: Removed all spring-based and bounce animations
- **Fast & Snappy**: Professional, instant screen transitions throughout

## v12.4 Updates

### Variable Selection Modal Fix
- **Centered Modal**: Variable selection now uses a centered modal instead of bottom sheet
- **Keyboard Dismiss**: `Keyboard.dismiss()` called when opening variable selector to prevent keyboard conflicts
- **No More Hang**: Removed bottom sheet that was being covered by keyboard
- **Black Text**: All text in variable picker hardcoded to #111111 for visibility

## v12.3 Updates

### Homepage Simplification
- **Removed Pipeline Chips**: Order Pipeline section removed from homepage for cleaner layout
- **Reduced Metric Cards**: Kept only Active Orders and Products cards, removed Total Stock and Low Stock cards
- **Low Stock Alert**: Low stock alert section still visible when items need attention

### Product Variables Screen - White Theme
- **Full White Theme**: Product Variables screen now uses white background matching other screens
- **Consistent Colors**: All text uses standard light theme colors (#111111, #666666, #999999)
- **Improved Readability**: Variable values and edit inputs now clearly visible with proper contrast

### Smart Audit Notifications
- **Audit Banner**: Red banner appears on homepage between 25th-31st of month
- **Auto-Dismiss**: Banner disappears once monthly audit is completed
- **Global Tracking**: Audit logs stored in global state with month/year tracking

### Recent Orders Feed
- **Last 5 Orders**: Homepage shows recent orders with customer name, product, and status
- **Quick Navigation**: Tap any order to view full details
- **Status Colors**: Each order shows status badge with appropriate color

## v12.2 Updates

### Full-Screen Product Form
- **Modal to Full-Screen**: New Product form now opens as full-screen view instead of modal
- **Back Button Header**: Standard header with ArrowLeft back button and Create button on right
- **KeyboardAwareScrollView**: Smooth keyboard handling with extraScrollHeight={100} for variant fields

### Category Manager in Settings
- **New Screen**: Dedicated Category Manager screen under Settings > Inventory
- **Add/Delete Categories**: Users can add new categories and delete existing ones
- **Global Database**: Categories saved globally and shared across all products

### Category Visibility Fix
- **Repositioned**: Categories moved to appear immediately after Product Name (before Description)
- **Black Chips**: Selected categories display as black chips with white text
- **No Overlap**: Global Pricing section pushed further down to prevent overlap

### Performance Optimizations
- **useCallback Handlers**: All form handlers wrapped in useCallback to prevent re-renders
- **Functional State Updates**: Using `setVariants(prev => ...)` pattern for stable updates
- **Full/Partial Refund Logic**: Order status shows "Full Refund" or "Partial Refund" based on amount

## v12.1 Updates

### Component Layout Fixes
- **NewProductScreen Categories**: Refactored to use FlexWrap layout preventing neighboring component misalignment
- **Category Dropdown**: Added proper zIndex for dropdown overlay positioning
- **Low Stock Field**: Moved to separate row below categories for cleaner layout

### Order Refund Display
- **Refund Row in Red**: Refunds now display in red (#EF4444) in order items summary
- **Total Calculation**: Total now subtracts refund amount when applicable
- **Original Amount Shown**: Original order total displayed below adjusted total

### Variable Selector Fix
- **zIndex Corrected**: Variable selector dropdowns properly layer above content
- **Text Color Fixed**: All text in selectors hardcoded to #111111 for visibility
- **White Background**: Selector modals use solid white (#FFFFFF) backgrounds

### Audit Screen Header Fix
- **Route Registered**: inventory-audit added to _layout.tsx with headerShown: false
- **No Double Headers**: Custom header now works without navigation header conflict

## v12.0 Updates

### Global White Theme Protocol
- **All Screens White**: Every page (Inventory, Audit, Orders, Settings, Insights) has solid white background
- **Inventory Screen Fixed**: Previously stuck in dark mode, now forced to white with black text
- **Headers Repositioned**: All headers moved to very top with proper spacing for Dynamic Island
- **Consistent Light Theme**: Force light theme colors throughout all screens

### Unified Product & Variant Workflow
- **Add = Edit Template**: "Add New Product" screen is now a 1:1 clone of "Edit Product" UI
- **Category Dropdown**: Categories use dropdown selection from Settings (no manual text entry)
- **Searchable Variant Selection**: Removed horizontal swipe list, replaced with searchable dropdown
- **52px Field Heights**: All input fields (Product Name, variant selection) use 52px height

### Smart Pricing Inheritance
- **Global Pricing Enforcement**: When "Global Pricing" is enabled, new variants auto-inherit the price
- **Sale Price Hidden**: Sale Price field not shown for variants when Global Pricing is ON
- **Auto-populate**: System auto-populates price invisibly from main product price

### Professional Inventory Audit
- **Fixed Header Positioning**: Back button and header moved to top of screen
- **Search Bar Added**: Search products by SKU or Name in "Start New Audit" list
- **Combined Naming**: Items show as "[Product Name] [Variant Name]" (e.g., "Aviator 1.0 Gold")
- **White Theme**: Audit screens use consistent light theme

## v11.0 Features (Retained)

### Global Theme Fix (Strict Light Mode)
- **White Backgrounds**: Every screen, modal, and card has solid white background
- **Black Text (#111111)**: All text uses solid black for maximum legibility
- **Black Primary Buttons**: All primary buttons are solid black with white text
- **Dark Grey Input Borders (#444444)**: All text fields have dark grey borders
- **52px Input Height**: Premium, accessible input field heights throughout
- **Black Cursor**: All text inputs use black cursor color

### Status Colors Update
- **Refunded Status**: Now displays in Red (#EF4444)
- **Processing Status**: Added as new default status for orders (Blue #3B82F6)
- **Quality Check**: Now uses Black (#111111) instead of green
- **Icons/Highlights**: Changed from green to black throughout the app

### Unified Product & Variant Logic
- **Edit Product = Add Product**: Both workflows use identical layout and fields
- **Editable Variant Names**: Users can edit Variant Name/Value directly (e.g., "Pink" to "Soft Pink")
- **Global Pricing Toggle**:
  - ON: Hide individual Sale Price fields, all variants inherit the global price
  - OFF: Show Sale Price field for each variant
- **Default Order Status**: All new orders default to "Processing" status

### Restored Audit Workflow (3-Button Layout)
- **Start New Audit**: Opens list of current stock to reconcile with physical counts
- **View Audit History**: Shows past audit logs with timestamps
- **Current Inventory**: Quick view of live stock levels
- **Audit Logging**: Completed audits update master stock and save time-stamped logs

## v10.0 Features (Retained)

### Variable Logic & Variant Creation
- **Variable Type Selection**: Select Variable Type (e.g., Color, Size) from Settings dropdown first
- **Editable Value Field**: Type any custom value (e.g., "Pink", "XXL")
- **Auto-SKU Generation**: SKU auto-populates as [PRODUCTNAME]-[VALUE]
- **Manual SKU Override**: Type custom SKU if needed

### Global Categories Database
- **Permanent Categories**: Categories saved globally when created in any product
- **Smart Search Dropdown**: Search through all existing categories
- **Multi-Select**: Tap multiple categories from the dropdown
- **Add New on the Fly**: Type new category and it's saved to global database

### Advanced Order Editing & CRM
- **Edit Everything**: Full order editing capability - no locked fields
- **Swap Products**: Change/add/remove products on existing orders
- **Change Logistics**: Update carrier and pickup date anytime
- **Update Customer Details**: Edit customer info after order creation
- **Stock Adjustment**: Automatic stock reconciliation when editing order items

### Customer Save-on-Order
- **Save to Customer Database Toggle**: Save customer info when creating orders
- **Existing Customer Search**: Search by name, phone, or email
- **Auto-fill Forms**: Select existing customer to auto-populate all fields

## Design Philosophy

- **Strict Light Mode**: Pure white backgrounds, black text, black buttons
- **High-Contrast**: Black text (#111111) on white backgrounds (#FFFFFF)
- **Dark Grey Input Borders**: #444444 for all input fields
- **52px Inputs**: Premium, accessible input field heights
- **Fluid Animations**: Spring-based entrance animations with staggered reveals
- **Haptic Feedback**: Tactile responses for all interactive elements

## Features

### Dashboard (Clickable Metric Cards)
- Real-time analytics with revenue and stock metrics
- **Active Orders** -> navigates to Orders tab
- **Total Stock** -> navigates to Inventory tab
- Revenue breakdown: Product Sales, Delivery Fees, Services
- Low stock alerts with urgency indicators

### Order Management
- **Default Status**: New orders start as "Processing"
- **Customer Selection**: Search existing customers or create new
- **Deep Search**: Search by product name OR variant attributes
- Complete customer information with all 36 Nigerian states + FCT
- **Custom Services**: Lens Coating, Express Delivery from catalog
- **Payment Methods**: Bank Transfer, POS, Website Payment, Cash
- **Logistics & Tracking**: Carrier selection, pickup date
- **Refund Processing**: Full refund system with proof upload (Red status)
- **Full Edit Capability**: Edit any order after saving

### Inventory Management
- Product catalog with multi-variant support (Color, Size, Material)
- **Add/Edit/Delete Variants**: Full variant management with editable names
- **Global Pricing Toggle**: Set one price for all variants or individual prices
- Real-time stock adjustments with +/- controls
- Low stock filtering and search

### Inventory Audit (3-Button Layout)
- **Start New Audit**: Count physical inventory, reconcile discrepancies
- **View Audit History**: Past audits with timestamps and discrepancy counts
- **Current Inventory**: Quick view of all stock levels
- Automatic stock updates upon audit completion

### Customer Management (CRM)
- Customer registry with full contact info
- Default delivery address and state per customer
- Quick customer lookup when creating orders
- Permanent storage for repeat customers

### Insights & Analytics
- Total Revenue and Net Revenue after refunds
- Inventory value tracking
- Top logistics carriers by volume
- Sales breakdown by platform

### Product Variables
- Define attributes like Color, Size, Material
- Edit Variable Type names
- Add/edit/delete values per variable
- Clean themed UI with centered modal

### Settings & Customization
- Custom order statuses with colors (includes Processing, Refunded)
- Custom sale sources
- Custom Services Catalog with prices
- Payment Methods management
- Logistics Carriers (GIG, DHL, FedEx, Kwik, etc.)
- Product variables (attributes)
- Demo data reset

## Currency

Nigerian Naira (NGN) as default currency. All prices in NGN.

## Project Structure

```
src/
├── app/
│   ├── (tabs)/              # Tab navigation screens
│   │   ├── _layout.tsx      # Tab bar with responsive sidebar
│   │   ├── index.tsx        # Dashboard
│   │   ├── inventory.tsx    # Inventory list with split view
│   │   ├── orders.tsx       # Order list with split view
│   │   ├── insights.tsx     # Analytics & Insights
│   │   └── settings.tsx     # Settings
│   ├── _layout.tsx          # Root layout
│   ├── customers.tsx        # Customer management with split view
│   ├── inventory-audit.tsx  # 3-button audit workflow
│   ├── label-print.tsx      # Label print preview with barcode
│   ├── new-order.tsx        # Create order (defaults to Processing)
│   ├── new-product.tsx      # Create product with Global Pricing
│   ├── order/[id].tsx       # Order detail with refund & logistics
│   ├── product/[id].tsx     # Product detail with editable variant names
│   └── product-variables.tsx # Variable type management
├── components/
│   ├── SplitViewLayout.tsx  # Responsive split view container
│   ├── DesktopSidebar.tsx   # Desktop left sidebar navigation
│   ├── ProductDetailPanel.tsx # Product detail panel for split view
│   ├── OrderDetailPanel.tsx # Order detail panel for split view
│   ├── CustomerDetailPanel.tsx # Customer detail panel for split view
│   └── ...
└── lib/
    ├── state/
    │   └── fyll-store.ts    # Zustand store (Processing + Refunded statuses)
    ├── useBreakpoint.ts     # Responsive breakpoint hook
    ├── theme.ts             # Light/dark theme colors
    └── cn.ts                # className utility
```

## Tech Stack

- Expo SDK 53
- React Native 0.76.7
- NativeWind (TailwindCSS)
- Zustand for state management
- React Native Reanimated for animations
- DateTimePicker for date selection
- Expo Camera for barcode scanning
- Expo Image Picker for refund proof uploads
