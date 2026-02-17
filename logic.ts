import { RelationshipStore, GuildMemberStore, UserStore, VoiceStateStore, ChannelStore, PresenceStore, FluxDispatcher } from "@webpack/common";

export enum FriendFilter {
    ALL = "all",
    GUILD = "guild",
    CHANNEL = "channel"
}

const STATUS_MAP: Record<string, number> = {
    online: 0,
    streaming: 1,
    idle: 2,
    dnd: 3,
    offline: 4,
    invisible: 5,
    unknown: 6
};

const STATUS_EMOJIS: Record<string, string> = {
    online: "🟢",
    idle: "🟡",
    dnd: "🔴",
    offline: "⚫",
    invisible: "⚫",
    unknown: "⚪"
};

function requestGuildMembers(guildId: string, userIds: string[], presences: boolean = true) {
    if (!userIds || userIds.length === 0) return;
    for (let i = 0; i < userIds.length; i += 100) {
        FluxDispatcher.dispatch({
            type: "GUILD_MEMBERS_REQUEST",
            guildIds: [guildId],
            userIds: userIds.slice(i, i + 100),
            presences
        });
    }
}

export async function getFriendsList(filter: FriendFilter, guildId?: string, channelId?: string): Promise<string> {
    const friendIds = RelationshipStore.getFriendIDs();

    if (friendIds.length === 0) return "🌵 You don't have any friends on this account.";

    let targetIds = friendIds;
    let syncTriggered = false;

    // If we're in a guild context, try to sync members who aren't cached
    if (guildId) {
        const missing = friendIds.filter(id => !GuildMemberStore.isMember(guildId, id));
        if (missing.length > 0) {
            requestGuildMembers(guildId, missing);
            syncTriggered = true;
            await new Promise(r => setTimeout(r, 1000)); // Short wait for initial sync
        }
    }

    const allVoiceStates = VoiceStateStore.getAllVoiceStates();
    const guildVoiceStates: Record<string, any> = (guildId ? allVoiceStates[guildId] : {}) || {};

    if (filter === FriendFilter.GUILD && guildId) {
        // Filter by guild membership (or being in a VC in that guild)
        targetIds = friendIds.filter(id => GuildMemberStore.isMember(guildId, id) || !!guildVoiceStates[id]);
        if (targetIds.length === 0) return "🔍 No friends found in this server.";
    } else if (filter === FriendFilter.CHANNEL && channelId) {
        // Filter by specific voice channel
        const channelVoiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
        const occupants = Object.keys(channelVoiceStates || {});
        targetIds = friendIds.filter(id => occupants.includes(id));
        if (targetIds.length === 0) return "🎙️ No friends found in this voice channel.";
    }

    // Capture info for sorting and display
    const friendInfo = targetIds.map(id => {
        const user = UserStore.getUser(id);
        const status = PresenceStore.getStatus(id) || "unknown";
        const vState = guildVoiceStates[id] || VoiceStateStore.getVoiceStateForUser(id);
        const name = user?.globalName || user?.username || id;
        return { id, name, status, channelId: vState?.channelId };
    });

    // Sort by status priority then name
    friendInfo.sort((a, b) => {
        const statusA = STATUS_MAP[a.status] ?? 6;
        const statusB = STATUS_MAP[b.status] ?? 6;
        if (statusA !== statusB) return statusA - statusB;
        return a.name.localeCompare(b.name);
    });

    const titlePrefix = filter === FriendFilter.CHANNEL ? "Voice Channel" : filter === FriendFilter.GUILD ? "Server" : "Account";
    const headerSuffix = filter === FriendFilter.GUILD && guildId ? `in Server` : (filter === FriendFilter.CHANNEL && channelId ? `in Voice Channel` : "on Account");

    let output = `## 👥 Mutual Friends ${headerSuffix} (${friendInfo.length})\n`;

    const lines = friendInfo.map(f => {
        const emoji = STATUS_EMOJIS[f.status] || STATUS_EMOJIS.unknown;
        const name = `<@${f.id}>`;
        let location = "";

        if (f.channelId) {
            location = `: 🎙️ <#${f.channelId}>`;
        } else {
            location = `: ${emoji} ${f.status.charAt(0).toUpperCase() + f.status.slice(1)}`;
        }
        return `- ${name}${location}`;
    });

    output += lines.join("\n");

    if (syncTriggered) {
        output += "\n\n*Note: Some friends may still be syncing. Try running again if anyone is missing.*";
    }

    return output;
}
