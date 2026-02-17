import definePlugin from "@utils/types";
import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import { SelectedChannelStore, ChannelStore } from "@webpack/common";
import { sendMessage } from "@utils/discord";
import { pluginInfo } from "./info";
import { getFriendsList, FriendFilter } from "./logic";

export default definePlugin({
    ...pluginInfo,
    commands: [
        {
            name: "friends",
            description: "List mutual friends and their current location.",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "filter",
                    description: "Filter friends by location",
                    type: ApplicationCommandOptionType.STRING,
                    required: false,
                    choices: [
                        { name: "All Mutual Friends", label: "All Mutual Friends", value: FriendFilter.ALL },
                        { name: "Current Server", label: "Current Server", value: FriendFilter.GUILD },
                        { name: "Current Voice Channel", label: "Current Voice Channel", value: FriendFilter.CHANNEL }
                    ]
                },
                {
                    name: "share",
                    description: "Share the list in the current channel",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                const filter = findOption(args, "filter", FriendFilter.ALL) as FriendFilter;
                const share = findOption(args, "share", false) as boolean;

                const guildId = ctx.guild?.id || ChannelStore.getChannel(ctx.channel.id)?.guild_id;
                const channelId = SelectedChannelStore.getVoiceChannelId();

                const output = await getFriendsList(filter, guildId, channelId);

                if (share) {
                    sendMessage(ctx.channel.id, { content: output });
                } else {
                    const { sendBotMessage } = require("@api/Commands");
                    sendBotMessage(ctx.channel.id, { content: output });
                }
            }
        }
    ]
});
