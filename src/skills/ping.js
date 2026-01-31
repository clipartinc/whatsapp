export default {
  name: 'ping',
  match: async ({ text }) => text === 'ping',
  run: async ({ message }) => message.reply('pong ✅')
}
