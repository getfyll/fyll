export type TeamThreadChannelId = 'hq-general' | 'logistics-updates' | 'announcements';

export interface TeamThreadChannel {
  id: TeamThreadChannelId;
  name: string;
  subtitle: string;
  entityId: string;
}

const TEAM_THREAD_ENTITY_PREFIX = '__team_thread__';

const toEntityId = (id: TeamThreadChannelId) => `${TEAM_THREAD_ENTITY_PREFIX}:${id}`;

export const TEAM_THREAD_CHANNELS: TeamThreadChannel[] = [
  {
    id: 'hq-general',
    name: 'HQ General',
    subtitle: 'Morning team! Share updates and blockers here.',
    entityId: toEntityId('hq-general'),
  },
  {
    id: 'logistics-updates',
    name: 'Logistics Updates',
    subtitle: 'Dispatch, delays, and carrier updates.',
    entityId: toEntityId('logistics-updates'),
  },
  {
    id: 'announcements',
    name: 'Announcements',
    subtitle: 'Important notices from management.',
    entityId: toEntityId('announcements'),
  },
];

const channelById = new Map(TEAM_THREAD_CHANNELS.map((channel) => [channel.id, channel]));
const channelByEntityId = new Map(TEAM_THREAD_CHANNELS.map((channel) => [channel.entityId, channel]));

export const getTeamThreadChannelById = (value?: string | null): TeamThreadChannel | null => {
  if (!value) return null;
  return channelById.get(value as TeamThreadChannelId) ?? null;
};

export const getTeamThreadChannelByEntityId = (value?: string | null): TeamThreadChannel | null => {
  if (!value) return null;
  return channelByEntityId.get(value) ?? null;
};

export const isTeamThreadEntityId = (entityId: string | null | undefined): boolean => (
  typeof entityId === 'string' && entityId.startsWith(`${TEAM_THREAD_ENTITY_PREFIX}:`)
);

export const getTeamThreadChannelIdFromEntityId = (entityId: string | null | undefined): TeamThreadChannelId | null => {
  if (!isTeamThreadEntityId(entityId)) return null;
  const [, rawChannelId] = (entityId as string).split(':');
  return getTeamThreadChannelById(rawChannelId)?.id ?? null;
};

const toTitleCase = (value: string) => value
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

export const getTeamThreadDisplayNameFromEntityId = (entityId: string | null | undefined): string => {
  if (!entityId) return 'Team Thread';
  const defaultChannel = getTeamThreadChannelByEntityId(entityId);
  if (defaultChannel) return defaultChannel.name;
  if (!isTeamThreadEntityId(entityId)) return 'Team Thread';

  const parts = entityId.split(':');
  const rawSlug = parts[2] ? parts.slice(2).join(':') : parts[1] ?? '';
  const normalized = rawSlug.replace(/[-_]+/g, ' ').trim();
  if (!normalized) return 'Team Thread';
  return toTitleCase(normalized);
};

export const getTeamThreadSubtitleFromEntityId = (entityId: string | null | undefined): string => {
  const defaultChannel = getTeamThreadChannelByEntityId(entityId);
  if (defaultChannel) return defaultChannel.subtitle;
  return 'Team updates and internal collaboration.';
};

export const buildCustomTeamThreadEntityId = (name: string, existingEntityIds: string[] = []): string => {
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'team-thread';

  const existing = new Set(existingEntityIds);
  let candidate = `${TEAM_THREAD_ENTITY_PREFIX}:${baseSlug}`;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${TEAM_THREAD_ENTITY_PREFIX}:${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};
