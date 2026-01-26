import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, ChevronLeft, FileText, Filter } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';
import useFyllStore, {
  Case,
  CaseStatus,
  CASE_STATUS_COLORS,
} from '@/lib/state/fyll-store';
import { CaseListItem } from '@/components/CaseListItem';
import { CaseDetailPanel } from '@/components/CaseDetailPanel';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function CasesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { isDesktop, isTablet } = useBreakpoint();

  const cases = useFyllStore((s) => s.cases);
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const getStatusColor = (statusName: string) =>
    caseStatuses.find((status) => status.name === statusName)?.color
    ?? CASE_STATUS_COLORS[statusName]
    ?? colors.text.muted;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | 'All'>('All');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Filter cases
  const filteredCases = useMemo(() => {
    let filtered = [...cases];

    // Filter by status
    if (selectedStatus !== 'All') {
      filtered = filtered.filter((c) => c.status === selectedStatus);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(query) ||
          c.customerName.toLowerCase().includes(query) ||
          c.orderNumber.toLowerCase().includes(query) ||
          c.issueSummary.toLowerCase().includes(query)
      );
    }

    // Sort by created date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [cases, selectedStatus, searchQuery]);

  // Count cases by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: cases.length };
    caseStatuses.forEach((status) => {
      counts[status.name] = cases.filter((c) => c.status === status.name).length;
    });
    return counts;
  }, [cases, caseStatuses]);

  const handleCasePress = (caseId: string) => {
    Haptics.selectionAsync();
    if (isDesktop || isTablet) {
      setSelectedCaseId(caseId);
    } else {
      router.push(`/case/${caseId}`);
    }
  };

  const renderStatusFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4"
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}
    >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSelectedStatus('All');
          }}
          className="px-4 py-2 rounded-full border active:opacity-80"
          style={{
            borderColor: selectedStatus === 'All' ? colors.accent.primary : colors.border.light,
            backgroundColor: selectedStatus === 'All' ? colors.accent.primary : colors.bg.secondary,
          }}
        >
        <Text
          style={{ color: selectedStatus === 'All' ? '#fff' : colors.text.primary }}
          className="font-medium text-xs"
        >
          All ({statusCounts.All})
        </Text>
      </Pressable>
      {caseStatuses.map((status) => {
        const count = statusCounts[status.name] || 0;
        if (count === 0) return null;
        const statusColor = getStatusColor(status.name);
        const isSelected = selectedStatus === status.name;
        return (
          <Pressable
            key={status.id}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedStatus(status.name);
            }}
            className="px-4 py-2 rounded-full border active:opacity-80"
            style={{
              borderColor: isSelected ? statusColor : colors.border.light,
              backgroundColor: isSelected ? statusColor : colors.bg.secondary,
            }}
          >
            <Text
              style={{ color: isSelected ? '#fff' : statusColor }}
              className="font-medium text-xs"
            >
              {status.name} ({count})
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderEmptyState = () => (
    <Animated.View
      entering={FadeInDown.springify()}
      className="flex-1 items-center justify-center py-20"
    >
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: colors.bg.secondary }}
      >
        <FileText size={40} color={colors.text.muted} strokeWidth={1} />
      </View>
      <Text style={{ color: colors.text.primary }} className="text-xl font-bold mb-2">
        No Cases Found
      </Text>
      <Text style={{ color: colors.text.muted }} className="text-center px-10">
        {searchQuery || selectedStatus !== 'All'
          ? 'Try adjusting your filters or search query'
          : 'Cases will appear here when created from orders'}
      </Text>
    </Animated.View>
  );

  const renderList = () => (
    <FlatList
      data={filteredCases}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
      <CaseListItem
        caseItem={item}
        onPress={() => handleCasePress(item.id)}
        index={index}
        compact
      />
      )}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexGrow: filteredCases.length === 0 ? 1 : undefined,
      }}
      showsVerticalScrollIndicator={false}
    />
  );

  // Desktop/Tablet: Split view
  if (isDesktop || isTablet) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        {/* Header */}
        <View
          className="flex-row items-center px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            className="p-2 -ml-2 active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.text.primary} strokeWidth={1.5} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold ml-2">
            All Cases
          </Text>
        </View>

        <View className="flex-1 flex-row">
          {/* List Panel */}
          <View
            className="flex-1"
            style={{
              maxWidth: isDesktop ? 400 : 320,
              borderRightWidth: 1,
              borderRightColor: colors.border.light,
            }}
          >
            {/* Search */}
            <View className="px-5 py-3">
              <View
                className="flex-row items-center px-4 py-3 rounded-xl"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Search size={20} color={colors.text.muted} strokeWidth={1.5} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search cases..."
                  placeholderTextColor={colors.text.muted}
                  className="flex-1 ml-3"
                  style={{ color: colors.text.primary }}
                />
              </View>
            </View>

            {/* Status Filters */}
            {renderStatusFilter()}

            {/* List */}
            {renderList()}
          </View>

          {/* Detail Panel */}
          <View className="flex-1">
            {selectedCaseId ? (
              <CaseDetailPanel
                caseId={selectedCaseId}
                onClose={() => setSelectedCaseId(null)}
                onNavigateToOrder={(orderId) => router.push(`/order/${orderId}`)}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <FileText size={48} color={colors.text.muted} strokeWidth={1} />
                <Text style={{ color: colors.text.muted }} className="mt-4 text-lg">
                  Select a case to view details
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Mobile: Full-width list
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          className="p-2 -ml-2 active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.text.primary} strokeWidth={1.5} />
        </Pressable>
        <Text style={{ color: colors.text.primary }} className="text-xl font-bold ml-2">
          All Cases
        </Text>
      </View>

      {/* Search */}
      <View className="px-5 py-3">
        <View
          className="flex-row items-center px-4 py-3 rounded-xl"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          <Search size={20} color={colors.text.muted} strokeWidth={1.5} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search cases..."
            placeholderTextColor={colors.text.muted}
            className="flex-1 ml-3"
            style={{ color: colors.text.primary }}
          />
        </View>
      </View>

      {/* Status Filters */}
      {renderStatusFilter()}

      {/* List */}
      {renderList()}
    </SafeAreaView>
  );
}
