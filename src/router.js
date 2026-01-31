export async function routeMessage({ message, skills, ctxBase }) {
    const textRaw = (message.content || '').trim()
    const text = textRaw.toLowerCase()
  
    const ctx = {
      ...ctxBase,
      message,
      textRaw,
      text
    }
  
    for (const skill of skills) {
      try {
        const ok = await skill.match(ctx)
        if (ok) {
          await skill.run(ctx)
          return true
        }
      } catch (err) {
        console.error(`Skill crashed: ${skill.name}`, err)
        await ctx.log(`❌ Skill crashed: ${skill.name}\n\`${err?.message || err}\``)
        await message.reply('❌ Something broke. Check #moltbot-logs.')
        return true
      }
    }
    return false
  }
  