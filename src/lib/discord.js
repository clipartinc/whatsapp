export async function findTextChannelByName(guild, name) {
  if (!guild) return null
  const ch = guild.channels.cache.find(c => c?.name === name)
  if (!ch) return null
  return ch.isTextBased() ? ch : null
}

export async function findTextChannelById(guild, id) {
  if (!guild || !id) return null
  const ch = guild.channels.cache.get(id)
  if (!ch) return null
  return ch.isTextBased() ? ch : null
}

export async function postToChannel(guild, channelName, content) {
  const ch = await findTextChannelByName(guild, channelName)
  if (!ch) {
    console.error(`Channel not found: ${channelName}`)
    return false
  }
  await ch.send(content)
  return true
}

export async function postToChannelById(guild, channelId, content) {
  const ch = await findTextChannelById(guild, channelId)
  if (!ch) {
    console.error(`Channel ID not found: ${channelId}`)
    return false
  }
  await ch.send(content)
  return true
}
  