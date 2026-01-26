import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, ChevronDown, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';
import useFyllStore, {
  Case,
  CaseType,
  CaseStatus,
  CasePriority,
  CaseSource,
  CaseResolution,
  ResolutionType,
  CaseTimelineEntry,
  CASE_STATUS_COLORS,
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_PRIORITY_COLORS,
  CASE_SOURCES,
  CaseAttachment,
  CaseStatusOption,
  RESOLUTION_TYPES,
  generateCaseNumber,
  generateCaseId,
  formatCurrency,
} from '@/lib/state/fyll-store';
import {
  Mail,
  Phone,
  MessageSquare,
  Globe,
  Store,
  HelpCircle,
  Flag,
  RefreshCcw,
  Undo2,
  DollarSign,
  Zap,
  ShieldCheck,
} from 'lucide-react-native';

// Get icon for case type
const getCaseTypeIcon = (type: CaseType, color: string, size: number = 18) => {
  const props = { size, color, strokeWidth: 1.5 };
  switch (type) {
    case 'Repair': return <RefreshCcw {...props} />;
    case 'Replacement': return <Undo2 {...props} />;
    case 'Refund': return <DollarSign {...props} />;
    case 'Partial Refund': return <Zap {...props} />;
    case 'Goodwill': return <ShieldCheck {...props} />;
    default: return <HelpCircle {...props} />;
  }
};

// Get icon for case source
const getCaseSourceIcon = (source: CaseSource, color: string, size: number = 18) => {
  const props = { size, color, strokeWidth: 1.5 };
  switch (source) {
    case 'Email': return <Mail {...props} />;
    case 'Phone': return <Phone {...props} />;
    case 'Chat': return <MessageSquare {...props} />;
    case 'Web': return <Globe {...props} />;
    case 'In-Store': return <Store {...props} />;
    default: return <HelpCircle {...props} />;
  }
};
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface CaseFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (caseData: Case) => void;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  existingCase?: Case;
  createdBy?: string;
}

export function CaseForm({
  visible,
  onClose,
  onSave,
  orderId,
  orderNumber,
  customerId,
  customerName,
  existingCase,
  createdBy,
}: CaseFormProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const isEditing = !!existingCase;

  const [caseType, setCaseType] = useState<CaseType>('Other');
  const [status, setStatus] = useState<CaseStatus>('Open');
  const [priority, setPriority] = useState<CasePriority>('Medium');
  const [source, setSource] = useState<CaseSource>('Email');
  const [issueSummary, setIssueSummary] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [attachments, setAttachments] = useState<CaseAttachment[]>(existingCase?.attachments ?? []);
  const [forceCompression, setForceCompression] = useState(true);
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const statusOptions = caseStatuses.length > 0
    ? caseStatuses.map((option) => option.name)
    : Object.keys(CASE_STATUS_COLORS);
  const statusColorMap = caseStatuses.reduce<Record<string, string>>((map, option) => {
    map[option.name] = option.color;
    return map;
  }, {});
  Object.entries(CASE_STATUS_COLORS).forEach(([name, color]) => {
    if (!statusColorMap[name]) {
      statusColorMap[name] = color;
    }
  });
  const selectedStatusOption = caseStatuses.find((option) => option.name === status);

  // Resolution fields
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionType, setResolutionType] = useState<ResolutionType>('No Action Required');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionValue, setResolutionValue] = useState('');
  const [showResolutionTypeDropdown, setShowResolutionTypeDropdown] = useState(false);

  useEffect(() => {
    const defaultStatus = caseStatuses[0]?.name ?? 'Open';
    if (existingCase) {
      setCaseType(existingCase.type);
      setStatus(existingCase.status);
      setPriority(existingCase.priority || 'Medium');
      setSource(existingCase.source || 'Email');
      setIssueSummary(existingCase.issueSummary);
      setOriginalMessage(existingCase.originalCustomerMessage || '');
      setAttachments(existingCase.attachments ?? []);
      if (existingCase.resolution) {
        setShowResolution(true);
        setResolutionType(existingCase.resolution.type);
        setResolutionNotes(existingCase.resolution.notes);
        setResolutionValue(existingCase.resolution.value?.toString() || '');
      }
    } else {
      // Reset form for new case
      setCaseType('Other');
      setStatus(defaultStatus);
      setPriority('Medium');
      setSource('Email');
      setIssueSummary('');
      setOriginalMessage('');
      setAttachments([]);
      setShowResolution(false);
      setResolutionType('No Action Required');
      setResolutionNotes('');
      setResolutionValue('');
    }
  }, [existingCase, visible, caseStatuses]);

  // Show resolution section when status is Resolved or Closed
  useEffect(() => {
    if (status === 'Resolved' || status === 'Closed') {
      setShowResolution(true);
    }
  }, [status]);

  const handleAddAttachment = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo access to attach proof images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [],
        {
          compress: forceCompression ? 0.6 : 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const newAttachment: CaseAttachment = {
        id: Math.random().toString(36).slice(2),
        label: asset.fileName || `Image ${attachments.length + 1}`,
        uri: manipulated.uri,
        preview: manipulated.base64 ? `data:image/jpeg;base64,${manipulated.base64}` : undefined,
        uploadedAt: new Date().toISOString(),
      };

      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.warn('Case attachment failed:', error);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleSave = () => {
    if (!issueSummary.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const now = new Date().toISOString();
    let resolution: CaseResolution | undefined;

    if (showResolution && (status === 'Resolved' || status === 'Closed')) {
      resolution = {
        type: resolutionType,
        notes: resolutionNotes,
        value: resolutionValue ? parseFloat(resolutionValue) : undefined,
        resolvedAt: existingCase?.resolution?.resolvedAt || now,
        resolvedBy: createdBy,
      };
    }

    // Create initial timeline entry for new cases
    let timeline: CaseTimelineEntry[] | undefined = existingCase?.timeline;
    if (!isEditing) {
      const initialEntry: CaseTimelineEntry = {
        id: Math.random().toString(36).slice(2),
        date: now,
        action: 'Case Created',
        user: createdBy || 'System',
      };
      timeline = [initialEntry];
    }

    const caseData: Case = {
      id: existingCase?.id || generateCaseId(),
      caseNumber: existingCase?.caseNumber || generateCaseNumber(),
      orderId,
      orderNumber,
      customerId,
      customerName,
      type: caseType,
      status,
      priority,
      source,
      issueSummary: issueSummary.trim(),
      originalCustomerMessage: originalMessage.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
      timeline,
      resolution,
      createdAt: existingCase?.createdAt || now,
      updatedAt: now,
      createdBy: existingCase?.createdBy || createdBy,
      updatedBy: createdBy,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(caseData);
    onClose();
  };

  const renderDropdown = (
    items: string[],
    selected: string,
    onSelect: (item: any) => void,
    show: boolean,
    setShow: (show: boolean) => void,
    colorMap?: Record<string, string>,
  ) => (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
      setShow(!show);
    }}
    className="flex-row items-center justify-between py-3 px-4 rounded-xl"
    style={{
      backgroundColor: colors.bg.secondary,
      borderWidth: 1,
      borderColor: show ? colors.accent.primary : colors.border.light,
    }}
  >
        <View className="flex-row items-center gap-2">
          {colorMap && (
            <View
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colorMap[selected] || colors.text.muted }}
            />
          )}
          <Text style={{ color: colors.text.primary }} className="font-medium">
            {selected}
          </Text>
        </View>
        <ChevronDown size={20} color={colors.text.muted} strokeWidth={1.5} />
      </Pressable>

      {show && (
        <View
          className="mt-1 rounded-xl overflow-hidden"
          style={{
            backgroundColor: colors.bg.card,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(item);
                setShow(false);
              }}
              className="flex-row items-center justify-between py-3 px-4"
              style={{
                backgroundColor: item === selected ? colors.bg.secondary : 'transparent',
              }}
            >
              <View className="flex-row items-center gap-2">
                {colorMap && (
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorMap[item] || colors.text.muted }}
                  />
                )}
                <Text style={{ color: colors.text.primary }}>{item}</Text>
              </View>
              {item === selected && (
                <Check size={18} color={colors.accent.primary} strokeWidth={2} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: colors.bg.primary }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              className="p-2 -ml-2 active:opacity-70"
            >
              <X size={24} color={colors.text.primary} strokeWidth={1.5} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
              {isEditing ? 'Edit Case' : 'New Case'}
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            className="px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: colors.accent.primary }}
          >
            <Text className="text-white font-semibold">
              {isEditing ? 'Update' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
          {/* Order Info (read-only) */}
          <View className="mb-6">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
              Linked Order
            </Text>
            <View
              className="p-4 rounded-xl"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <Text style={{ color: colors.text.primary }} className="font-semibold">
                {orderNumber}
              </Text>
              <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                {customerName}
              </Text>
            </View>
          </View>

          {/* Case Type - Grid Selection */}
          <View className="mb-5">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Case Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CASE_TYPES.map((type) => {
                const isSelected = caseType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCaseType(type);
                    }}
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl active:opacity-80"
                    style={{
                      backgroundColor: isSelected ? colors.bg.tertiary : colors.bg.secondary,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.text.primary : colors.border.light,
                    }}
                  >
                    <View
                      className="p-1.5 rounded-lg"
                      style={{
                        backgroundColor: isSelected ? colors.text.primary : colors.bg.primary,
                      }}
                    >
                      {getCaseTypeIcon(type, isSelected ? colors.bg.primary : colors.text.secondary, 14)}
                    </View>
                    <Text
                      style={{ color: isSelected ? colors.text.primary : colors.text.secondary }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Priority Selection */}
          <View className="mb-5">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Priority
            </Text>
            <View
              className="flex-row p-1.5 rounded-2xl"
              style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
            >
              {CASE_PRIORITIES.map((p) => {
                const isSelected = priority === p;
                const priorityColor = CASE_PRIORITY_COLORS[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPriority(p);
                    }}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl active:opacity-80"
                    style={{
                      backgroundColor: isSelected ? colors.bg.card : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: isSelected ? priorityColor + '50' : 'transparent',
                    }}
                  >
                    {isSelected && <Flag size={12} color={priorityColor} strokeWidth={2} />}
                    <Text
                      style={{ color: isSelected ? priorityColor : colors.text.muted }}
                      className="text-[10px] font-bold uppercase tracking-tighter"
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Source Channel */}
          <View className="mb-5">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Source Channel
            </Text>
            <View
              className="flex-row flex-wrap p-1.5 rounded-2xl gap-1"
              style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
            >
              {CASE_SOURCES.map((s) => {
                const isSelected = source === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSource(s);
                    }}
                    className="flex-col items-center justify-center py-3 px-4 rounded-xl active:opacity-80"
                    style={{
                      backgroundColor: isSelected ? colors.bg.card : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: isSelected ? colors.border.medium : 'transparent',
                      minWidth: 70,
                    }}
                  >
                    {getCaseSourceIcon(s, isSelected ? colors.text.primary : colors.text.muted, 18)}
                    <Text
                      style={{ color: isSelected ? colors.text.primary : colors.text.muted }}
                      className="text-[10px] font-bold uppercase tracking-tighter mt-1"
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Status */}
          <View className="mb-4">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
              Status
            </Text>
          {renderDropdown(
            statusOptions,
            status,
            setStatus,
            showStatusDropdown,
            setShowStatusDropdown,
            statusColorMap,
          )}
          {selectedStatusOption?.description ? (
            <Text style={{ color: colors.text.tertiary, marginTop: 4, fontSize: 12 }}>
              {selectedStatusOption.description}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              router.push('/settings?section=case-statuses');
            }}
            className="mt-2"
          >
            <Text style={{ color: colors.accent.primary }} className="text-xs font-semibold">
              Customize case statuses in Settings
            </Text>
          </Pressable>
        </View>

          {/* Issue Summary */}
          <View className="mb-4">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
              Issue Summary *
            </Text>
            <TextInput
              value={issueSummary}
              onChangeText={setIssueSummary}
              placeholder="Brief description of the issue..."
              placeholderTextColor={colors.text.muted}
              className="py-3 px-4 rounded-xl"
              style={{
                backgroundColor: colors.bg.secondary,
                color: colors.text.primary,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            />
          </View>

          {/* Original Customer Message */}
          <View className="mb-4">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
              Original Customer Message
            </Text>
            <TextInput
              value={originalMessage}
              onChangeText={setOriginalMessage}
              placeholder="Paste the customer's original complaint or message..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={4}
              className="py-3 px-4 rounded-xl"
              style={{
                backgroundColor: colors.bg.secondary,
                color: colors.text.primary,
                borderWidth: 1,
                borderColor: colors.border.light,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Proof Attachments */}
          <View className="mb-4">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
              Proof Images
            </Text>
            <View className="flex-row items-center justify-between mb-3">
              <Pressable
                onPress={handleAddAttachment}
                className="px-4 py-2 rounded-xl active:opacity-80"
                style={{ backgroundColor: '#111111' }}
              >
                <Text className="text-white font-semibold text-xs">Add Image</Text>
              </Pressable>
              <View className="flex-row items-center gap-2">
                <Switch
                  value={forceCompression}
                  onValueChange={(value) => {
                    Haptics.selectionAsync();
                    setForceCompression(value);
                  }}
                  trackColor={{ false: '#E5E5E5', true: '#22C55E' }}
                  thumbColor="#FFFFFF"
                />
                <Text style={{ color: colors.text.tertiary }} className="text-xs">
                  Force compression
                </Text>
              </View>
            </View>
            {attachments.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                {attachments.map((attachment) => (
                  <View key={attachment.id} className="mr-3" style={{ position: 'relative' }}>
                    <View className="rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                      <Image
                        source={{ uri: attachment.preview ?? attachment.uri }}
                        style={{ width: 120, height: 120 }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => handleRemoveAttachment(attachment.id)}
                        className="w-8 h-8 rounded-full items-center justify-center absolute top-2 right-2"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
                      >
                        <X size={14} color="#fff" strokeWidth={2} />
                      </Pressable>
                    </View>
                    <Text style={{ color: colors.text.secondary }} className="text-[11px] mt-2 text-center">
                      {attachment.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Resolution Section */}
          {showResolution && (
            <View
              className="p-4 rounded-xl mb-4"
              style={{
                backgroundColor: colors.bg.secondary,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            >
              <Text style={{ color: colors.text.primary }} className="font-semibold mb-4">
                Resolution Details
              </Text>

              {/* Resolution Type */}
              <View className="mb-4">
                <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
                  Resolution Type
                </Text>
                {renderDropdown(
                  RESOLUTION_TYPES,
                  resolutionType,
                  setResolutionType,
                  showResolutionTypeDropdown,
                  setShowResolutionTypeDropdown,
                )}
              </View>

              {/* Resolution Value (for refunds/credits) */}
              {(resolutionType === 'Refund Issued' || resolutionType === 'Credit Applied') && (
                <View className="mb-4">
                  <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
                    Resolution Value
                  </Text>
                  <TextInput
                    value={resolutionValue}
                    onChangeText={setResolutionValue}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    className="py-3 px-4 rounded-xl"
                    style={{
                      backgroundColor: colors.bg.primary,
                      color: colors.text.primary,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                    }}
                  />
                </View>
              )}

              {/* Resolution Notes */}
              <View>
                <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-2">
                  Resolution Notes
                </Text>
                <TextInput
                  value={resolutionNotes}
                  onChangeText={setResolutionNotes}
                  placeholder="How was this case resolved..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                  className="py-3 px-4 rounded-xl"
                  style={{
                    backgroundColor: colors.bg.primary,
                    color: colors.text.primary,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>
          )}

          {/* Add resolution button if not showing */}
          {!showResolution && status !== 'Resolved' && status !== 'Closed' && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowResolution(true);
              }}
              className="py-3 px-4 rounded-xl mb-4 active:opacity-70"
              style={{
                backgroundColor: colors.bg.secondary,
                borderWidth: 1,
                borderColor: colors.border.light,
                borderStyle: 'dashed',
              }}
            >
              <Text style={{ color: colors.text.secondary }} className="text-center">
                + Add Resolution Details
              </Text>
            </Pressable>
          )}

          {/* Spacer for keyboard */}
          <View className="h-20" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default CaseForm;
