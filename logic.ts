import { RelationshipStore, GuildMemberStore, UserStore, VoiceStateStore, ChannelStore, PresenceStore } from "@webpack/common";

export enum FriendFilter {
    ALL = "all",
    GUILD = "guild",
    CHANNEL = "channel"
}

const STATUS_EMOJIS: Record<string, string> = {
    online: "🟢",
    idle: "🟡",
    dnd: "🔴",
    offline: "⚫",
    invisible: "⚫",
    unknown: "⚪"
};

export function getFriendsList(filter: FriendFilter, guildId?: string, channelId?: string): string {
    const friendIds = RelationshipStore.getFriendIDs();

    if (friendIds.length === 0) return "🌵 You don't have any friends on this account.";

    let targetIds = friendIds;

    if (filter === FriendFilter.GUILD && guildId) {
        targetIds = friendIds.filter(id => GuildMemberStore.isMember(guildId, id));
        if (targetIds.length === 0) return "🔍 No friends found in this server.";
    } else if (filter === FriendFilter.CHANNEL && channelId) {
        const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
        const occupants = Object.keys(voiceStates || {});
        targetIds = friendIds.filter(id => occupants.includes(id));
        if (targetIds.length === 0) return "🎙️ No friends found in this voice channel.";
    }

    const titlePrefix = filter === FriendFilter.CHANNEL ? "Voice Channel" : filter === FriendFilter.GUILD ? "Server" : "Account";
    const lines: string[] = [`## 👥 Mutual Friends on ${titlePrefix} (${targetIds.length})`];

    for (const friendId of targetIds) {
        const user = UserStore.getUser(friendId);
        const name = user ? `<@${friendId}>` : `Unknown (\`${friendId}\`)`;

        const presence = PresenceStore.getStatus(friendId);
        const emoji = STATUS_EMOJIS[presence] || STATUS_EMOJIS.unknown;

        const voiceState = VoiceStateStore.getVoiceState(guildId || "", friendId);
        let status = emoji;

        if (voiceState && voiceState.channelId) {
            status = `🎙️ <#${voiceState.channelId}>`;
        } else {
            status = `${emoji} ${presence.charAt(0).toUpperCase() + presence.slice(1)}`;
        }

        lines.push(`- ${name}: ${status}`);
    }

    return lines.join("\n");
}
