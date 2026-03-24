import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useFyllStore, { formatCurrency, Product } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { getActiveSplitCardStyle } from '@/lib/selection-style';
import { normalizeProductType } from '@/lib/product-utils';
import { DESKTOP_PAGE_HEADER_MIN_HEIGHT, getStandardPageHeadingStyle } from '@/lib/page-heading';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { ServiceDetailPanel } from '@/components/ServiceDetailPanel';
import { getSettingsWebPanelStyles } from '@/lib/settings-web-panel';

export default function ServicesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { isMobile, isDesktop } = useBreakpoint();
  const isDark = colors.bg.primary === '#111111';
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const showSplitView = !isMobile && !isWebDesktop;
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);
  const desktopHeaderMinHeight = DESKTOP_PAGE_HEADER_MIN_HEIGHT;
  const openedFromSettings = from === 'settings';
  const panelStyles = getSettingsWebPanelStyles(openedFromSettings, colors.bg.primary, colors.border.light);
  const settingsHeaderTopPadding = openedFromSettings ? 28 : 24;
  const separatorColor = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  const products = useFyllStore((s) => s.products);
  const isServiceProduct = (product: Product) => {
    if (normalizeProductType(product.productType) === 'service') return true;
    return Boolean(
      product.serviceTags?.length ||
      product.serviceVariables?.length ||
      product.serviceFields?.length
    );
  };

  const services = useMemo(
    () => products.filter((p) => isServiceProduct(p)),
    [products]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    let result = services;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((service) =>
        service.name.toLowerCase().includes(query)
        || service.serviceTags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [services, searchQuery]);

  const selectedService = useMemo(
    () => filteredServices.find((service) => service.id === selectedServiceId) ?? null,
    [filteredServices, selectedServiceId]
  );

  useEffect(() => {
    if (!showSplitView) return;
    if (selectedServiceId && filteredServices.some((service) => service.id === selectedServiceId)) return;
    setSelectedServiceId(filteredServices[0]?.id ?? null);
  }, [showSplitView, filteredServices, selectedServiceId]);

  const navigateToServiceDetail = (serviceId: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    router.push(`/services/${serviceId}`);
  };

  const handleOpenService = (serviceId: string) => {
    if (showSplitView) {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      setSelectedServiceId(serviceId);
      return;
    }
    navigateToServiceDetail(serviceId);
  };

  const handleAddService = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    router.push('/new-service');
  };

  const handleBackToSettings = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    router.push('/settings');
  };

  const renderRow = (service: Product, index: number) => {
    const category = service.serviceTags?.[0] ?? '—';
    const price = service.variants[0]?.sellingPrice ?? 0;
    const statusLabel = service.isDiscontinued ? 'Inactive' : 'Active';
    const statusColor = service.isDiscontinued ? '#9CA3AF' : '#10B981';
    const dateLabel = new Date(service.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const isSelected = showSplitView && selectedServiceId === service.id;

    return (
      <Pressable
        key={service.id}
        onPress={() => handleOpenService(service.id)}
        className="active:opacity-70"
        style={{
          backgroundColor: colors.bg.card,
          borderBottomWidth: index === filteredServices.length - 1 ? 0 : 1,
          borderBottomColor: separatorColor,
          borderLeftWidth: 0,
          borderLeftColor: 'transparent',
          ...getActiveSplitCardStyle({ isSelected, showSplitView, isDark, colors }),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 }}>
          <Text style={{ color: colors.text.primary, flex: 1.6 }} className="text-sm font-semibold" numberOfLines={1}>
            {service.name}
          </Text>
          <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>
            {category}
          </Text>
          <Text style={{ color: colors.text.primary, width: 140 }} className="text-sm font-semibold" numberOfLines={1}>
            {formatCurrency(price)}
          </Text>
          <Text style={{ color: colors.text.tertiary, width: 140 }} className="text-sm" numberOfLines={1}>
            {dateLabel}
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' }}>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: statusColor + '20', borderWidth: 1, borderColor: statusColor + '30' }}
            >
              <Text style={{ color: statusColor }} className="text-xs font-semibold">
                {statusLabel}
              </Text>
            </View>
            {showSplitView && (
              <View style={{ marginLeft: 10 }}>
                <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const compactMasterContent = (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View
        className="px-5 pb-2"
        style={{
          paddingTop: openedFromSettings ? 24 : 16,
          borderBottomWidth: 1,
          borderBottomColor: separatorColor,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {openedFromSettings ? (
            <Pressable
              onPress={handleBackToSettings}
              className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
          ) : null}

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>
                Services
              </Text>
              <Text style={{ color: colors.text.muted }} className="text-sm mt-1">
                {services.length} service{services.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable
              onPress={handleAddService}
              className="rounded-full items-center justify-center active:opacity-80"
              style={{ paddingHorizontal: 14, height: 44, flexDirection: 'row', backgroundColor: colors.accent.primary }}
            >
              <Plus size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
              <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5 text-sm">Add</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="px-5 pt-3">
        <View
          className="flex-row items-center rounded-full px-4"
          style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.border.light }}
        >
          <Search size={18} color={colors.text.muted} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search services..."
            placeholderTextColor={colors.input.placeholder}
            className="flex-1 ml-3"
            style={{ color: colors.input.text }}
          />
        </View>
      </View>

      <View className="px-5 pt-4 pb-24">
        {filteredServices.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.border.light }}>
              <Briefcase size={36} color={colors.text.muted} strokeWidth={1.5} />
            </View>
            <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No services found</Text>
            <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first service to get started</Text>
            <Pressable onPress={handleAddService} className="rounded-full active:opacity-80 px-6 py-3 flex-row items-center" style={{ backgroundColor: colors.accent.primary }}>
              <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
              <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5">Create First Service</Text>
            </Pressable>
          </View>
        ) : (
          filteredServices.map((service) => {
            const category = service.serviceTags?.[0] ?? '—';
            const price = service.variants[0]?.sellingPrice ?? 0;
            const isSelected = showSplitView && selectedServiceId === service.id;

            return (
              <Pressable
                key={service.id}
                onPress={() => handleOpenService(service.id)}
                className="active:opacity-70"
                style={{
                  backgroundColor: colors.bg.card,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border.light,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border.light,
                  ...getActiveSplitCardStyle({ isSelected, showSplitView, isDark, colors }),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                      {service.name}
                    </Text>
                    <Text style={{ color: colors.text.muted }} className="text-xs mt-2">
                      {category}
                    </Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-2">
                      {formatCurrency(price)}
                    </Text>
                  </View>
                  {showSplitView && (
                    <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const splitDetailContent = selectedServiceId
    ? <ServiceDetailPanel serviceId={selectedServiceId} />
    : null;

  return (
    <View style={panelStyles.outer}>
      <View style={panelStyles.inner}>
      <SafeAreaView className="flex-1" edges={isWebDesktop ? [] : ['top']}>
        {isWebDesktop ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 28,
              paddingTop: isWebDesktop ? 0 : settingsHeaderTopPadding,
              paddingBottom: 40,
              width: '100%',
              maxWidth: 1456,
              alignSelf: 'flex-start',
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                minHeight: desktopHeaderMinHeight,
                borderBottomWidth: 1,
                borderBottomColor: separatorColor,
                marginBottom: 12,
                justifyContent: 'center',
                marginHorizontal: -28,
                paddingHorizontal: 28,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {openedFromSettings ? (
                  <Pressable
                    onPress={handleBackToSettings}
                    className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                ) : null}

                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>
                      Services
                    </Text>
                    <Text style={{ color: colors.text.muted, fontSize: 14, marginTop: 4 }}>
                      {services.length} service{services.length !== 1 ? 's' : ''} available.
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleAddService}
                    className="flex-row items-center px-4 rounded-full active:opacity-80"
                    style={{ backgroundColor: colors.text.primary, height: 42 }}
                  >
                    <Plus size={18} color={colors.bg.primary} strokeWidth={2.5} />
                    <Text style={{ color: colors.bg.primary }} className="font-semibold ml-1.5 text-sm">
                      New Service
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                className="flex-row items-center rounded-full px-4"
                style={{
                  height: 44,
                  width: '30%',
                  maxWidth: 420,
                  minWidth: 320,
                  backgroundColor: colors.input.bg,
                  borderWidth: 1,
                  borderColor: colors.border.light,
                }}
              >
                <Search size={18} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search services..."
                  placeholderTextColor={colors.input.placeholder}
                  style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
                />
              </View>
            </View>

            <View
              style={{
                marginTop: 16,
                borderWidth: 1,
                borderColor: separatorColor,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.bg.card,
              }}
            >
              <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: separatorColor }}>
                <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12 }}>
                  <Text style={{ color: colors.text.muted, flex: 1.6 }} className="text-xs font-semibold">
                    SERVICE
                  </Text>
                  <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold">
                    TAG
                  </Text>
                  <Text style={{ color: colors.text.muted, width: 140 }} className="text-xs font-semibold">
                    PRICE
                  </Text>
                  <Text style={{ color: colors.text.muted, width: 140 }} className="text-xs font-semibold">
                    ADDED
                  </Text>
                  <Text style={{ color: colors.text.muted, flex: 1, textAlign: 'right' }} className="text-xs font-semibold">
                    STATUS
                  </Text>
                </View>
              </View>

              {filteredServices.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <View style={{ width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: colors.border.light }}>
                    <Briefcase size={36} color={colors.text.muted} strokeWidth={1.5} />
                  </View>
                  <Text style={{ color: colors.text.tertiary, fontSize: 16, marginBottom: 4 }}>No services found</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: 16 }}>Add your first service to get started</Text>
                  <Pressable onPress={handleAddService} style={{ backgroundColor: colors.accent.primary, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                    <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontWeight: '600', marginLeft: 6 }}>Create First Service</Text>
                  </Pressable>
                </View>
              ) : (
                filteredServices.map(renderRow)
              )}
            </View>
          </ScrollView>
        ) : showSplitView ? (
          <SplitViewLayout
            detailContent={splitDetailContent}
            detailTitle={selectedService?.name || 'Service Details'}
            onCloseDetail={() => setSelectedServiceId(null)}
          >
            {compactMasterContent}
          </SplitViewLayout>
        ) : (
          compactMasterContent
        )}
      </SafeAreaView>
      </View>
    </View>
  );
}
