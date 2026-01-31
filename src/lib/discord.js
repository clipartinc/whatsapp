export async function findTextChannelByName(guild, name) {
    if (!guild) return null
    const ch = guild.channels.cache.find(c => c?.name === name)
    if (!ch) return null
    return ch.isTextBased() ? ch : null
  }
  
  export async function postToChannel(guild, channelName, content) {
    const ch = await findTextChannelByName(guild, channelName)
    if (!ch) return false
    await ch.send(content)
    return true
  }
  